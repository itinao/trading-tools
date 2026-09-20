import { Logger } from '@trading/cli'
import { createTestDatabase } from '@trading/db/testing'
import { upsertUniverse } from '@trading/domain'
import type {
  FinancialsProvider,
  FundamentalsProvider,
  QuoteMetricsProvider,
} from '@trading/market-data'
import { describe, expect, it } from 'vitest'
import { buildCriteria } from '../src/criteria.ts'
import { growthStreak, runScreen } from '../src/run.ts'

const config = {
  defaults: { segments: ['prime', 'standard'] as const, limit: 50, marketCapMin: 100 },
  presets: {
    value: { perMax: 12, pbrMax: 1, dividendMin: 3, sort: 'dividendYield' as const },
    growth: { growthYears: 2, sort: 'growthYears' as const },
  },
}
const context = (dryRun = false) => ({
  options: { dryRun, quiet: true, verbose: false },
  logger: new Logger(() => {}, 'error'),
  dbPath: ':memory:',
  readInput: <T>() => ({}) as T,
})

describe('buildCriteria', () => {
  it('既定 < プリセット < オプション', () => {
    const { criteria, preset } = buildCriteria(
      { preset: 'value', perMax: '10', segment: 'prime' },
      config as never,
    )
    expect(preset).toBe('value')
    expect(criteria).toMatchObject({
      segments: ['prime'],
      perMax: 10,
      pbrMax: 1,
      dividendMin: 3,
      marketCapMin: 100,
      sort: 'dividendYield',
      limit: 50,
    })
    expect(() => buildCriteria({ preset: 'nope' }, config as never)).toThrow(
      expect.objectContaining({ code: 'usage' }),
    )
    expect(() => buildCriteria({ segment: 'x' }, config as never)).toThrow(
      expect.objectContaining({ code: 'usage' }),
    )
    expect(() => buildCriteria({ perMax: 'abc' }, config as never)).toThrow(
      expect.objectContaining({ code: 'usage' }),
    )
  })
})

describe('growthStreak', () => {
  it('新しい期から数えて、増収増益が途切れるまで', () => {
    const p = (end: string, r: number, o: number) => ({
      periodType: 'annual' as const,
      periodEnd: end,
      revenue: r,
      operatingIncome: o,
    })
    expect(
      growthStreak([
        p('2026-03-31', 130, 13),
        p('2025-03-31', 120, 12),
        p('2024-03-31', 110, 11),
        p('2023-03-31', 100, 10),
      ]),
    ).toBe(3)
    expect(
      growthStreak([p('2026-03-31', 130, 9), p('2025-03-31', 120, 12), p('2024-03-31', 110, 11)]),
    ).toBe(0)
    expect(
      growthStreak([p('2026-03-31', 130, 13), p('2025-03-31', 120, 12), p('2024-03-31', 125, 11)]),
    ).toBe(1)
    expect(growthStreak([])).toBe(0)
  })
})

const metrics: QuoteMetricsProvider = {
  name: 'fake',
  fetchQuoteMetrics: async (codes) =>
    codes.map((code) => ({
      code,
      price: 100,
      per: code === '1111' ? 8 : code === '2222' ? 11 : 30,
      pbr: code === '3333' ? 2 : 0.8,
      dividendYield: code === '1111' ? 4 : code === '2222' ? 3.5 : 1,
      marketCap: code === '4444' ? 10 : 1000,
    })),
}
const financials: FinancialsProvider = {
  name: 'fake',
  fetchFinancials: async (code) => ({
    code,
    ok: true,
    periods: [
      {
        periodType: 'annual',
        periodEnd: '2026-03-31',
        revenue: code === '2222' ? 90 : 130,
        operatingIncome: 13,
        totalAssets: 1000,
        equity: 500,
      },
      { periodType: 'annual', periodEnd: '2025-03-31', revenue: 120, operatingIncome: 12 },
      { periodType: 'annual', periodEnd: '2024-03-31', revenue: 110, operatingIncome: 11 },
    ],
  }),
}
const fundamentals: FundamentalsProvider = {
  name: 'fake',
  fetchFundamentals: async (codes) =>
    codes.map((code) => ({ code, ok: true as const, roe: 12, operatingMargin: 15 })),
}

describe('runScreen', () => {
  it('母集団 → 一括指標で絞る → 上位だけ財務を取る → 保存', async () => {
    const handle = createTestDatabase()
    upsertUniverse(handle.db, [
      {
        code: '1111',
        name: 'A',
        segment: 'prime',
        segmentRaw: 'p',
        sector33: 'x',
        size: null,
        listedAsOf: '2026-08-31',
      },
      {
        code: '2222',
        name: 'B',
        segment: 'standard',
        segmentRaw: 's',
        sector33: 'y',
        size: null,
        listedAsOf: '2026-08-31',
      },
      {
        code: '3333',
        name: 'C',
        segment: 'prime',
        segmentRaw: 'p',
        sector33: 'x',
        size: null,
        listedAsOf: '2026-08-31',
      },
      {
        code: '4444',
        name: 'D',
        segment: 'prime',
        segmentRaw: 'p',
        sector33: 'x',
        size: null,
        listedAsOf: '2026-08-31',
      },
      {
        code: '5555',
        name: 'E',
        segment: 'growth',
        segmentRaw: 'g',
        sector33: 'x',
        size: null,
        listedAsOf: '2026-08-31',
      },
    ])
    const built = buildCriteria({ preset: 'value' }, config as never)
    const r = await runScreen(handle, context(), built, { metrics, financials, fundamentals })
    // 5555 は growth で母集団外、3333 は PBR 2、4444 は時価総額不足、残り 1111（配当 4）と 2222（3.5）
    expect(r.universeSize).toBe(4)
    expect(r.results.map((x) => [x.rank, x.code, x.growthYears])).toEqual([
      [1, '1111', 2],
      [2, '2222', 0],
    ])
    expect(r.runId).toBe(1)

    const g = await runScreen(
      handle,
      context(),
      buildCriteria({ preset: 'growth' }, config as never),
      { metrics, financials, fundamentals },
    )
    // growthYears ≥ 2 は 2222 以外（2222 は減収）。marketCapMin 100 で 4444 は落ちる
    expect(g.results.map((x) => x.code).sort()).toEqual(['1111', '3333'])
    expect(g.results[0]?.growthYears).toBe(2)
    handle.close()
  })
  it('母集団が無ければ no_universe、--dry-run は保存しない', async () => {
    const handle = createTestDatabase()
    await expect(
      runScreen(handle, context(), buildCriteria({}, config as never), {
        metrics,
        financials,
        fundamentals,
      }),
    ).rejects.toMatchObject({ code: 'no_universe' })
    upsertUniverse(handle.db, [
      {
        code: '1111',
        name: 'A',
        segment: 'prime',
        segmentRaw: 'p',
        sector33: 'x',
        size: null,
        listedAsOf: '2026-08-31',
      },
    ])
    const r = await runScreen(handle, context(true), buildCriteria({}, config as never), {
      metrics,
      financials,
      fundamentals,
    })
    expect(r.runId).toBeNull()
    handle.close()
  })
})
