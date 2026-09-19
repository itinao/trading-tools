import { Logger } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { holdingTargets } from '@trading/domain'
import type { QuoteProvider } from '@trading/market-data'
import { describe, expect, it } from 'vitest'
import { collectQuotes } from '../src/quotes.ts'

function seed(handle: DatabaseHandle) {
  const now = '2026-01-01T00:00:00+09:00'
  handle.db
    .insert(schema.instruments)
    .values([
      { id: 'JP:1234', market: 'JP', code: '1234', name: 'A', createdAt: now, updatedAt: now },
      { id: 'JP:5678', market: 'JP', code: '5678', name: 'B', createdAt: now, updatedAt: now },
    ])
    .run()
  const older = handle.db
    .insert(schema.holdingSnapshots)
    .values({
      source: 'rakuten',
      asOf: '2025-12-01T00:00:00+09:00',
      fileName: 'old.csv',
      importedAt: now,
      rowCount: 1,
      skippedJson: '{}',
    })
    .returning({ id: schema.holdingSnapshots.id })
    .get()
  const latest = handle.db
    .insert(schema.holdingSnapshots)
    .values({
      source: 'rakuten',
      asOf: '2026-01-01T00:00:00+09:00',
      fileName: 'new.csv',
      importedAt: now,
      rowCount: 2,
      skippedJson: '{}',
    })
    .returning({ id: schema.holdingSnapshots.id })
    .get()
  const h = (snapshotId: number, instrumentId: string, account: string, price: number) => ({
    snapshotId,
    instrumentId,
    account,
    quantity: 100,
    averageCost: 1000,
    priceAtSnapshot: price,
    marketValue: 100 * price,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
  })
  handle.db
    .insert(schema.holdings)
    .values([
      h(older?.id ?? 0, 'JP:5678', '特定', 1),
      h(latest?.id ?? 0, 'JP:1234', '特定', 2500),
      h(latest?.id ?? 0, 'JP:1234', '旧NISA', 2500),
      h(latest?.id ?? 0, 'JP:5678', '特定', 700),
    ])
    .run()
}

const context = (dryRun = false) => ({
  options: { dryRun, quiet: true, verbose: false },
  logger: new Logger(() => {}, 'error'),
  dbPath: ':memory:',
  readInput: <T>() => ({}) as T,
})

const fakeProvider = (prices: Record<string, number | null>): QuoteProvider => ({
  name: 'fake',
  fetchQuotes: async (codes) =>
    codes.map((code) => {
      const p = prices[code]
      return p == null
        ? { code, ok: false as const, reason: 'nope' }
        : { code, ok: true as const, price: p, previousClose: p + 10 }
    }),
})

describe('holdingTargets', () => {
  it('最新スナップショットの銘柄を口座の重複なしで返す', () => {
    const handle = createTestDatabase()
    seed(handle)
    expect(
      holdingTargets(handle.db)
        .map((t) => t.code)
        .sort(),
    ).toEqual(['1234', '5678'])
    handle.close()
  })
  it('スナップショットがなければ空', () => {
    const handle = createTestDatabase()
    expect(holdingTargets(handle.db)).toEqual([])
    handle.close()
  })
})

describe('collectQuotes', () => {
  it('取れた分を保存し、失敗は failed に列挙して ok', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const r = await collectQuotes(handle, context(), { asOf: '2026-01-05' }, () =>
      fakeProvider({ '1234': 2400, '5678': null }),
    )
    expect(r).toEqual({
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

  it('同じ日の再実行は上書きで行が増えない', async () => {
    const handle = createTestDatabase()
    seed(handle)
    await collectQuotes(handle, context(), { asOf: '2026-01-05' }, () =>
      fakeProvider({ '1234': 2400, '5678': 700 }),
    )
    await collectQuotes(handle, context(), { asOf: '2026-01-05' }, () =>
      fakeProvider({ '1234': 2300, '5678': 700 }),
    )
    const rows = handle.db.select().from(schema.quotes).all()
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.instrumentId === 'JP:1234')?.price).toBe(2300)
    // 別の日は別の行
    await collectQuotes(handle, context(), { asOf: '2026-01-06' }, () =>
      fakeProvider({ '1234': 2200, '5678': 700 }),
    )
    expect(handle.db.select().from(schema.quotes).all()).toHaveLength(4)
    handle.close()
  })

  it('全件失敗は all_failed', async () => {
    const handle = createTestDatabase()
    seed(handle)
    await expect(
      collectQuotes(handle, context(), { asOf: '2026-01-05' }, () => fakeProvider({})),
    ).rejects.toMatchObject({ code: 'all_failed' })
    handle.close()
  })

  it('対象がなければ no_targets', async () => {
    const handle = createTestDatabase()
    await expect(
      collectQuotes(handle, context(), {}, () => fakeProvider({})),
    ).rejects.toMatchObject({ code: 'no_targets' })
    handle.close()
  })

  it('--dry-run は書かない', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const r = await collectQuotes(handle, context(true), { asOf: '2026-01-05' }, () =>
      fakeProvider({ '1234': 1, '5678': 2 }),
    )
    expect(r.fetched).toBe(2)
    expect(handle.db.select().from(schema.quotes).all()).toHaveLength(0)
    handle.close()
  })

  it('--as-of の形式が違えば usage', async () => {
    const handle = createTestDatabase()
    seed(handle)
    await expect(
      collectQuotes(handle, context(), { asOf: '2026/01/05' }, () => fakeProvider({})),
    ).rejects.toMatchObject({ code: 'usage' })
    handle.close()
  })
})
