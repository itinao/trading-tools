import { describe, expect, it } from 'vitest'
import { createYahooProvider, jstDate, type YahooClient } from '../src/index.ts'

const client: YahooClient = {
  quote: async (symbols) =>
    symbols
      .filter((s) => s !== '9999.T')
      .map((s) => ({
        symbol: s,
        regularMarketPrice: 3025,
        regularMarketPreviousClose: 3034,
        regularMarketTime: new Date('2026-09-18T06:30:00Z'), // 15:30 JST
      })),
  chart: async () => ({
    quotes: [
      {
        date: new Date('2025-09-01T00:00:00Z'),
        close: 2858.5,
        open: 2850,
        high: 2870,
        low: 2840,
        volume: 100,
      },
      { date: new Date('2025-09-02T00:00:00Z'), close: null },
      { date: new Date('2025-09-03T00:00:00Z'), close: 2900 },
    ],
  }),
  quoteSummary: async () => ({
    summaryDetail: { trailingPE: 8.6, forwardPE: 9.3, dividendYield: 0.0331 },
    defaultKeyStatistics: { priceToBook: 0.96 },
    financialData: {
      returnOnEquity: 0.12404,
      operatingMargins: 0.07863,
      revenueGrowth: 0.104,
      debtToEquity: 114.97,
    },
    calendarEvents: { earnings: { earningsDate: [new Date('2026-11-05T06:30:00Z')] } },
    price: { marketCap: 35_821_549_780_992 },
  }),
  fundamentalsTimeSeries: async (_s, o) =>
    o.type === 'annual'
      ? [
          {
            date: new Date('2025-03-31T00:00:00Z'),
            totalRevenue: 48e12,
            operatingIncome: 4.79e12,
            totalAssets: 90e12,
            stockholdersEquity: 36e12,
          },
          {
            date: new Date('2026-03-31T00:00:00Z'),
            totalRevenue: 50e12,
            operatingIncome: 3.77e12,
            totalAssets: 95e12,
            stockholdersEquity: 37e12,
            dilutedEPS: 300,
          },
          { date: new Date('2026-06-30T00:00:00Z') }, // 空行
        ]
      : [],
}

const provider = createYahooProvider({
  client,
  intervalMs: 0,
  now: () => new Date('2026-09-20T03:00:00Z'),
})

describe('yahoo provider', () => {
  it('jstDate は JST の日付', () => {
    expect(jstDate(new Date('2026-09-18T06:30:00Z'))).toBe('2026-09-18')
    expect(jstDate(new Date('2026-09-18T15:30:00Z'))).toBe('2026-09-19')
  })
  it('fetchQuotes は asOf を引け時刻の JST 日付にし、無い銘柄は失敗', async () => {
    const r = await provider.fetchQuotes(['7203', '9999'])
    expect(r[0]).toEqual({
      code: '7203',
      ok: true,
      price: 3025,
      previousClose: 3034,
      asOf: '2026-09-18',
    })
    expect(r[1]).toEqual({ code: '9999', ok: false, reason: 'no quote' })
  })
  it('fetchHistory は close の無い行を捨てる', async () => {
    const bars = await provider.fetchHistory?.('7203', '2025-09-01')
    expect(bars).toEqual([
      { asOf: '2025-09-01', close: 2858.5, open: 2850, high: 2870, low: 2840, volume: 100 },
      { asOf: '2025-09-03', close: 2900 },
    ])
  })
  it('fetchFundamentals は比率を % にする', async () => {
    const [r] = await provider.fetchFundamentals(['7203'])
    expect(r).toEqual({
      code: '7203',
      ok: true,
      per: 8.6,
      forwardPer: 9.3,
      pbr: 0.96,
      dividendYield: 3.31,
      marketCap: 35_821_549_780_992,
      roe: 12.4,
      operatingMargin: 7.86,
      revenueGrowth: 10.4,
      debtToEquity: 114.97,
      nextEarningsDate: '2026-11-05',
    })
  })
  it('fetchFinancials は年次と四半期を集め、空の期は捨てる', async () => {
    const r = await provider.fetchFinancials('7203')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.periods).toHaveLength(2)
    expect(r.periods[1]).toEqual({
      periodType: 'annual',
      periodEnd: '2026-03-31',
      revenue: 50e12,
      operatingIncome: 3.77e12,
      totalAssets: 95e12,
      equity: 37e12,
      eps: 300,
    })
  })
})
