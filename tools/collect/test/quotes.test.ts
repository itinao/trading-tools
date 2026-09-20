import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import type { Bar, QuoteProvider } from '@trading/market-data'
import { describe, expect, it } from 'vitest'
import { collectQuotes, quoteCount } from '../src/quotes.ts'
import { context, seed } from './helpers.ts'

const fake = (
  prices: Record<string, number | null>,
  opts: { asOf?: string; history?: Record<string, Bar[]> } = {},
): QuoteProvider => ({
  name: 'fake',
  fetchQuotes: async (codes) =>
    codes.map((code) => {
      const p = prices[code]
      return p == null
        ? { code, ok: false as const, reason: 'nope' }
        : {
            code,
            ok: true as const,
            price: p,
            previousClose: p + 10,
            ...(opts.asOf ? { asOf: opts.asOf } : {}),
          }
    }),
  ...(opts.history ? { fetchHistory: async (code: string) => opts.history?.[code] ?? [] } : {}),
})

describe('collectQuotes', () => {
  it('取れた分を保存し、失敗は failed に列挙して ok', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const r = await collectQuotes(
      handle,
      context(),
      { asOf: '2026-01-05' },
      fake({ '1234': 2400, '5678': null }),
    )
    expect(r).toMatchObject({
      asOf: '2026-01-05',
      provider: 'fake',
      targets: 2,
      fetched: 1,
      failed: [{ code: '5678', reason: 'nope' }],
    })
    const rows = handle.db.select().from(schema.quotes).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      instrumentId: 'JP:1234',
      asOf: '2026-01-05',
      price: 2400,
      previousClose: 2410,
      source: 'fake',
    })
    handle.close()
  })

  it('Provider が返す asOf を使い、--as-of 指定はそれを上書きする', async () => {
    const handle = createTestDatabase()
    seed(handle)
    await collectQuotes(
      handle,
      context(),
      {},
      fake({ '1234': 1, '5678': 2 }, { asOf: '2026-01-09' }),
    )
    expect(
      handle.db
        .select()
        .from(schema.quotes)
        .all()
        .map((q) => q.asOf),
    ).toEqual(['2026-01-09', '2026-01-09'])
    await collectQuotes(
      handle,
      context(),
      { asOf: '2026-01-10' },
      fake({ '1234': 1, '5678': 2 }, { asOf: '2026-01-09' }),
    )
    expect(handle.db.select().from(schema.quotes).all()).toHaveLength(4)
    handle.close()
  })

  it('同じ日の再実行は上書きで行が増えない', async () => {
    const handle = createTestDatabase()
    seed(handle)
    await collectQuotes(
      handle,
      context(),
      { asOf: '2026-01-05' },
      fake({ '1234': 2400, '5678': 700 }),
    )
    await collectQuotes(
      handle,
      context(),
      { asOf: '2026-01-05' },
      fake({ '1234': 2300, '5678': 700 }),
    )
    const rows = handle.db.select().from(schema.quotes).all()
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.instrumentId === 'JP:1234')?.price).toBe(2300)
    handle.close()
  })

  it('株価が 0 件の銘柄だけ日足を遡り、previous_close は前の足の終値', async () => {
    const handle = createTestDatabase()
    seed(handle)
    // 5678 には既に株価がある
    handle.db
      .insert(schema.quotes)
      .values({
        instrumentId: 'JP:5678',
        asOf: '2025-12-30',
        price: 1,
        previousClose: null,
        source: 'fake',
        fetchedAt: 'x',
      })
      .run()
    const history = {
      '1234': [
        { asOf: '2025-12-29', close: 2000 },
        { asOf: '2025-12-30', close: 2100 },
      ],
      '5678': [{ asOf: '2025-12-29', close: 999 }],
    }
    const r = await collectQuotes(
      handle,
      context(),
      { asOf: '2026-01-05' },
      fake({ '1234': 2400, '5678': 700 }, { history }),
    )
    expect(r.backfilled).toEqual([{ code: '1234', bars: 2 }])
    expect(quoteCount(handle, 'JP:1234')).toBe(3)
    expect(quoteCount(handle, 'JP:5678')).toBe(2)
    const b = handle.db
      .select()
      .from(schema.quotes)
      .all()
      .filter((q) => q.instrumentId === 'JP:1234' && q.asOf === '2025-12-30')
    expect(b[0]?.previousClose).toBe(2000)
    handle.close()
  })

  it('--backfill は全銘柄を遡る。--backfill の日付は検証される', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const history = {
      '1234': [{ asOf: '2025-12-29', close: 1 }],
      '5678': [{ asOf: '2025-12-29', close: 2 }],
    }
    const r = await collectQuotes(
      handle,
      context(),
      { asOf: '2026-01-05', backfill: true },
      fake({ '1234': 1, '5678': 2 }, { history }),
    )
    expect(r.backfilled.map((b) => b.code).sort()).toEqual(['1234', '5678'])
    await expect(
      collectQuotes(handle, context(), { backfill: '2025/1/1' }, fake({ '1234': 1 }, { history })),
    ).rejects.toMatchObject({ code: 'usage' })
    handle.close()
  })

  it('全件失敗は all_failed、対象なしは no_targets、--dry-run は書かない', async () => {
    const handle = createTestDatabase()
    await expect(collectQuotes(handle, context(), {}, fake({}))).rejects.toMatchObject({
      code: 'no_targets',
    })
    seed(handle)
    await expect(
      collectQuotes(handle, context(), { asOf: '2026-01-05' }, fake({})),
    ).rejects.toMatchObject({ code: 'all_failed' })
    const r = await collectQuotes(
      handle,
      context(true),
      { asOf: '2026-01-05' },
      fake({ '1234': 1, '5678': 2 }),
    )
    expect(r.fetched).toBe(2)
    expect(handle.db.select().from(schema.quotes).all()).toHaveLength(0)
    handle.close()
  })
})
