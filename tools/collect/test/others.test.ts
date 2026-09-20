import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import type {
  DisclosureProvider,
  FinancialsProvider,
  FundamentalsProvider,
  NewsProvider,
} from '@trading/market-data'
import { describe, expect, it } from 'vitest'
import { categorize, collectDisclosures } from '../src/disclosures.ts'
import { collectFinancials } from '../src/financials.ts'
import { collectFundamentals } from '../src/fundamentals.ts'
import { collectNews } from '../src/news.ts'
import { collectAll } from '../src/tool.ts'
import { context, seed } from './helpers.ts'

const fundamentals: FundamentalsProvider = {
  name: 'fake',
  fetchFundamentals: async (codes) =>
    codes.map((code) =>
      code === '5678'
        ? { code, ok: false, reason: 'nope' }
        : { code, ok: true, per: 8.6, dividendYield: 3.31, roe: 12.4 },
    ),
}
const financials: FinancialsProvider = {
  name: 'fake',
  fetchFinancials: async (code) =>
    code === '5678'
      ? { code, ok: false, reason: 'no annual data' }
      : {
          code,
          ok: true,
          periods: [
            { periodType: 'annual', periodEnd: '2025-03-31', revenue: 100, operatingIncome: 10 },
            { periodType: 'annual', periodEnd: '2026-03-31', revenue: 110, operatingIncome: 9 },
          ],
        },
}
const news = (calls: string[] = []): NewsProvider => ({
  name: 'fake',
  fetchNews: async (query) => {
    calls.push(query)
    if (query === 'サンプル商事') return []
    return [
      { title: 'A', url: 'https://x/a', publishedAt: '2026-01-01T09:00:00+09:00', publisher: 'P' },
      { title: 'B', url: 'https://x/b', publishedAt: '2026-01-02T09:00:00+09:00' },
    ]
  },
})
const disclosures: DisclosureProvider = {
  name: 'fake',
  fetchDisclosures: async (date) =>
    date === '2026-01-05'
      ? [
          {
            code: '1234',
            companyName: 'テスト製作所',
            disclosedAt: `${date}T15:00:00+09:00`,
            title: '業績予想の修正に関するお知らせ',
            pdfUrl: 'https://t/1.pdf',
            hasXbrl: true,
          },
          {
            code: '9999',
            companyName: '無関係',
            disclosedAt: `${date}T15:00:00+09:00`,
            title: 'x',
            pdfUrl: 'https://t/2.pdf',
            hasXbrl: false,
          },
        ]
      : [],
}

describe('collectFundamentals', () => {
  it('取れた分を保存し、同日は上書き', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const r = await collectFundamentals(handle, context(), fundamentals)
    expect(r).toMatchObject({ fetched: 1, failed: [{ code: '5678', reason: 'nope' }] })
    await collectFundamentals(handle, context(), fundamentals)
    const rows = handle.db.select().from(schema.fundamentals).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      instrumentId: 'JP:1234',
      per: 8.6,
      dividendYield: 3.31,
      roe: 12.4,
      pbr: null,
    })
    handle.close()
  })
})

describe('collectFinancials', () => {
  it('期ごとに保存し、再実行で増えない', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const r = await collectFinancials(handle, context(), financials)
    expect(r).toMatchObject({
      fetched: 1,
      periods: 2,
      failed: [{ code: '5678', reason: 'no annual data' }],
    })
    await collectFinancials(handle, context(), financials)
    expect(handle.db.select().from(schema.financials).all()).toHaveLength(2)
    handle.close()
  })
})

describe('collectNews', () => {
  it('正規化した銘柄名で検索し、URL の重複は無視する', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const calls: string[] = []
    const r = await collectNews(handle, context(), news(calls))
    expect(calls).toEqual(['テスト製作所', 'サンプル商事'])
    expect(r).toMatchObject({ fetched: 2, inserted: 2, failed: [] })
    const again = await collectNews(handle, context(), news())
    expect(again.inserted).toBe(0)
    expect(handle.db.select().from(schema.newsItems).all()).toHaveLength(2)
    handle.close()
  })
})

describe('collectDisclosures', () => {
  it('categorize', () => {
    expect(categorize('2026年3月期 決算短信〔日本基準〕（連結）')).toBe('earnings')
    expect(categorize('業績予想の修正に関するお知らせ')).toBe('forecast_revision')
    expect(categorize('剰余金の配当に関するお知らせ')).toBe('dividend')
    expect(categorize('自己株式の取得状況')).toBe('other')
  })
  it('保有銘柄の分だけ保存し、再実行で増えない', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const r = await collectDisclosures(handle, context(), { date: '2026-01-05' }, disclosures)
    expect(r).toMatchObject({ dates: ['2026-01-05'], scanned: 2, matched: 1, inserted: 1 })
    const rows = handle.db.select().from(schema.disclosures).all()
    expect(rows[0]).toMatchObject({
      instrumentId: 'JP:1234',
      category: 'forecast_revision',
      hasXbrl: 1,
    })
    expect(
      (await collectDisclosures(handle, context(), { date: '2026-01-05' }, disclosures)).inserted,
    ).toBe(0)
    handle.close()
  })
  it('日付の形式が違えば usage', async () => {
    const handle = createTestDatabase()
    seed(handle)
    await expect(
      collectDisclosures(handle, context(), { date: '20260105' }, disclosures),
    ).rejects.toMatchObject({ code: 'usage' })
    handle.close()
  })
})

describe('collectAll', () => {
  it('1 つが失敗しても続け、errors にまとめる', async () => {
    const handle = createTestDatabase()
    seed(handle)
    const r = await collectAll(handle, context(), {
      quotes: {
        name: 'fake',
        fetchQuotes: async (codes) =>
          codes.map((code) => ({ code, ok: true as const, price: 1, asOf: '2026-01-05' })),
      },
      fundamentals: {
        name: 'fake',
        fetchFundamentals: async () => {
          throw new Error('boom')
        },
      },
      financials,
      news: news(),
      disclosures,
    })
    expect(r).toHaveProperty('quotes')
    expect(r).toHaveProperty('financials')
    expect((r as { errors: Record<string, unknown> }).errors).toEqual({
      fundamentals: { code: 'internal', message: 'boom' },
    })
    handle.close()
  })
})

describe('collectUniverse', () => {
  it('一覧を入れ替え、区分ごとの件数を返す', async () => {
    const { collectUniverse } = await import('../src/universe.ts')
    const { universeCount } = await import('@trading/domain')
    const handle = createTestDatabase()
    const r = await collectUniverse(handle, context(), async () => [
      {
        code: '7203',
        name: 'トヨタ自動車',
        segment: 'prime',
        segmentRaw: 'プライム',
        sector33: '輸送用機器',
        size: null,
        listedAsOf: '2026-08-31',
      },
      {
        code: '1306',
        name: 'ETF',
        segment: 'other',
        segmentRaw: 'ETF',
        sector33: null,
        size: null,
        listedAsOf: '2026-08-31',
      },
    ])
    expect(r).toEqual({
      source: 'jpx',
      listedAsOf: '2026-08-31',
      rows: 2,
      bySegment: { prime: 1, other: 1 },
    })
    expect(universeCount(handle.db)).toBe(2)
    handle.close()
  })
})
