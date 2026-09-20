import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { addWatch, upsertUniverse } from '@trading/domain'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.ts'
import { growthStreak, oversoldQuality, valuationCheap } from '../src/rules/index.ts'
import { runDetect } from '../src/run.ts'

describe('valuationCheap', () => {
  const cfg = DEFAULT_CONFIG.valuation_cheap
  it('3 指標すべて満たしたときだけ。値が無ければ満たさない', () => {
    expect(valuationCheap({ per: 8, pbr: 0.9, dividendYield: 3.5, asOf: 'd' }, cfg)).toMatchObject({
      kind: 'valuation_cheap',
      severity: 'warn',
      value: 8,
    })
    expect(valuationCheap({ per: 13, pbr: 0.9, dividendYield: 3.5, asOf: 'd' }, cfg)).toBeNull()
    expect(valuationCheap({ per: 8, pbr: null, dividendYield: 3.5, asOf: 'd' }, cfg)).toBeNull()
    expect(valuationCheap({ per: -5, pbr: 0.9, dividendYield: 3.5, asOf: 'd' }, cfg)).toBeNull()
    expect(valuationCheap(null, cfg)).toEqual({ skipped: 'no fundamentals' })
  })
})

const p = (end: string, r: number, o: number) => ({
  periodEnd: end,
  revenue: r,
  operatingIncome: o,
  totalAssets: null,
  equity: null,
})

describe('growthStreak', () => {
  const cfg = DEFAULT_CONFIG.growth_streak
  it('3 年連続で鳴る。データ不足は skipped', () => {
    const four = [
      p('2026-03-31', 130, 13),
      p('2025-03-31', 120, 12),
      p('2024-03-31', 110, 11),
      p('2023-03-31', 100, 10),
    ]
    expect(growthStreak(four, cfg)).toMatchObject({ kind: 'growth_streak', value: 3 })
    expect(growthStreak([p('2026-03-31', 130, 9), ...four.slice(1)], cfg)).toBeNull()
    expect(growthStreak(four.slice(0, 3), cfg)).toMatchObject({
      skipped: expect.stringContaining('3 < 4'),
    })
  })
})

describe('oversoldQuality', () => {
  const cfg = DEFAULT_CONFIG.oversold_quality
  const day = (i: number) =>
    `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`
  const hist = (prices: number[]) => prices.map((price, i) => ({ asOf: day(300 - i), price }))
  const cheap = {
    kind: 'valuation_cheap' as const,
    severity: 'warn' as const,
    value: 8,
    details: {},
  }
  it('200 日線より下・高値から -15%・企業側の良さ、の 3 つが揃うと critical', () => {
    const history = hist([80, ...Array(205).fill(100)])
    expect(oversoldQuality(history, cheap, null, cfg, { ma: 200, drawdown: 60 })).toMatchObject({
      kind: 'oversold_quality',
      severity: 'critical',
      value: -20,
      details: { quality: 'valuation_cheap' },
    })
    expect(oversoldQuality(history, null, null, cfg, { ma: 200, drawdown: 60 })).toBeNull()
    expect(
      oversoldQuality(hist([90, ...Array(205).fill(100)]), cheap, null, cfg, {
        ma: 200,
        drawdown: 60,
      }),
    ).toBeNull()
    expect(
      oversoldQuality(hist([80, 100]), cheap, null, cfg, { ma: 200, drawdown: 60 }),
    ).toMatchObject({ skipped: expect.stringContaining('2 < 200') })
  })
})

describe('runDetect: ウォッチ銘柄', () => {
  it('取得単価比は評価せず、攻めのルールはウォッチにだけ適用する', () => {
    const handle = createTestDatabase()
    const NOW = '2026-01-01T00:00:00+09:00'
    upsertUniverse(handle.db, [
      {
        code: '7203',
        name: 'トヨタ',
        segment: 'prime',
        segmentRaw: 'p',
        sector33: null,
        size: null,
        listedAsOf: '2026-08-31',
      },
    ])
    addWatch(handle.db, '7203')
    handle.db
      .insert(schema.quotes)
      .values({
        instrumentId: 'JP:7203',
        asOf: '2026-01-05',
        price: 2500,
        previousClose: null,
        source: 't',
        fetchedAt: NOW,
      })
      .run()
    handle.db
      .insert(schema.fundamentals)
      .values({
        instrumentId: 'JP:7203',
        asOf: '2026-01-05',
        per: 8,
        pbr: 0.9,
        dividendYield: 3.5,
        source: 't',
        fetchedAt: NOW,
      })
      .run()
    const r = runDetect(
      handle,
      {
        options: { dryRun: false, quiet: true, verbose: false },
        logger: { info() {}, warn() {}, error() {}, debug() {} } as never,
        dbPath: ':memory:',
        readInput: <T>() => ({}) as T,
      },
      { asOf: '2026-01-05' },
      DEFAULT_CONFIG,
    )
    expect(r.evaluated).toBe(1)
    expect(r.skipped.find((s) => s.kind === 'price_drop_cost')?.reason).toBe('no average cost')
    const kinds = handle.db
      .select()
      .from(schema.signals)
      .all()
      .map((s) => s.kind)
    expect(kinds).toEqual(['valuation_cheap'])
    const action = handle.db.select().from(schema.actions).all()[0]
    expect(action?.title).toContain('割安の候補')
    handle.close()
  })
})
