import type {
  Bar,
  FinancialPeriod,
  FinancialsProvider,
  FinancialsResult,
  FundamentalsProvider,
  FundamentalsResult,
  QuoteMetrics,
  QuoteMetricsProvider,
  QuoteProvider,
  QuoteResult,
} from './provider.ts'
import { sleep } from './provider.ts'

/**
 * Yahoo Finance（非公式 yahoo-finance2）。Design Doc 0009 §2.1 / 0010 §3.1。
 * 外部クライアントは注入できる（テストではフィクスチャを返す偽物を渡す）。
 */

export interface YahooQuote {
  symbol: string
  regularMarketPrice?: number
  regularMarketPreviousClose?: number
  regularMarketTime?: Date
  trailingPE?: number
  forwardPE?: number
  priceToBook?: number
  dividendYield?: number
  trailingAnnualDividendYield?: number
  marketCap?: number
}
export interface YahooChart {
  quotes: {
    date: Date
    close: number | null
    open?: number | null
    high?: number | null
    low?: number | null
    volume?: number | null
  }[]
}
export interface YahooSummary {
  summaryDetail?: { trailingPE?: number; forwardPE?: number; dividendYield?: number }
  defaultKeyStatistics?: { priceToBook?: number }
  financialData?: {
    returnOnEquity?: number
    operatingMargins?: number
    revenueGrowth?: number
    debtToEquity?: number
  }
  calendarEvents?: { earnings?: { earningsDate?: Date[] } }
  price?: { marketCap?: number }
}
export interface YahooFundamentalsRow {
  date: Date
  totalRevenue?: number
  operatingIncome?: number
  netIncome?: number
  totalAssets?: number
  stockholdersEquity?: number
  operatingCashFlow?: number
  dilutedEPS?: number
}

export interface YahooClient {
  quote(symbols: string[]): Promise<YahooQuote[]>
  chart(
    symbol: string,
    options: { period1: string; period2?: string; interval: '1d' },
  ): Promise<YahooChart>
  quoteSummary(symbol: string, options: { modules: string[] }): Promise<YahooSummary>
  fundamentalsTimeSeries(
    symbol: string,
    options: {
      period1: string
      period2?: string
      type: 'annual' | 'quarterly'
      module: 'financials' | 'all'
    },
  ): Promise<YahooFundamentalsRow[]>
}

export interface YahooProviderOptions {
  client?: YahooClient
  /** リクエスト間の待ち時間（ms）。既定 200 */
  intervalMs?: number
  /** 現在時刻（テスト用） */
  now?: () => Date
}

const symbolOf = (code: string) => `${code}.T`
const codeOf = (symbol: string) => symbol.replace(/\.T$/, '')

/** Date を JST の YYYY-MM-DD にする */
export function jstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

const pct = (v: number | null | undefined) => (v == null ? undefined : Math.round(v * 10000) / 100)
const num = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? undefined : v)

/** undefined の値を持つキーを落とす（exactOptionalPropertyTypes 対応） */
function compact<T extends object>(obj: { [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

async function defaultClient(): Promise<YahooClient> {
  const { default: YahooFinance } = await import('yahoo-finance2')
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
  return {
    quote: (symbols) => yf.quote(symbols) as Promise<YahooQuote[]>,
    chart: (symbol, options) => yf.chart(symbol, options) as Promise<YahooChart>,
    quoteSummary: (symbol, options) =>
      yf.quoteSummary(symbol, options as never) as Promise<YahooSummary>,
    fundamentalsTimeSeries: (symbol, options) =>
      yf.fundamentalsTimeSeries(symbol, options as never) as Promise<YahooFundamentalsRow[]>,
  }
}

export function createYahooProvider(
  options: YahooProviderOptions = {},
): QuoteProvider & FundamentalsProvider & FinancialsProvider & QuoteMetricsProvider {
  const intervalMs = options.intervalMs ?? 200
  const now = options.now ?? (() => new Date())
  let clientPromise: Promise<YahooClient> | undefined
  const client = () => {
    clientPromise ??= options.client ? Promise.resolve(options.client) : defaultClient()
    return clientPromise
  }
  const today = () => jstDate(now())

  return {
    name: 'yahoo',

    async fetchQuotes(codes) {
      if (codes.length === 0) return []
      let quotes: YahooQuote[]
      try {
        quotes = await (await client()).quote(codes.map(symbolOf))
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        return codes.map<QuoteResult>((code) => ({ code, ok: false, reason }))
      }
      const bySymbol = new Map(quotes.map((q) => [q.symbol, q]))
      return codes.map<QuoteResult>((code) => {
        const q = bySymbol.get(symbolOf(code))
        if (!q || q.regularMarketPrice == null) return { code, ok: false, reason: 'no quote' }
        return compact<QuoteResult & { ok: true }>({
          code,
          ok: true,
          price: q.regularMarketPrice,
          previousClose: num(q.regularMarketPreviousClose),
          asOf: q.regularMarketTime ? jstDate(q.regularMarketTime) : undefined,
        })
      })
    },

    /** スクリーニング用の一括取得。quote() に 100 銘柄ずつ渡す（Design Doc 0013 §3.5） */
    async fetchQuoteMetrics(codes) {
      const c = await client()
      const out: QuoteMetrics[] = []
      for (let i = 0; i < codes.length; i += 100) {
        const batch = codes.slice(i, i + 100)
        let quotes: YahooQuote[] = []
        try {
          quotes = await c.quote(batch.map(symbolOf))
        } catch {
          quotes = []
        }
        for (const q of quotes) {
          if (q.regularMarketPrice == null) continue
          out.push(
            compact<QuoteMetrics>({
              code: codeOf(q.symbol),
              price: q.regularMarketPrice,
              per: num(q.trailingPE),
              forwardPer: num(q.forwardPE),
              pbr: num(q.priceToBook),
              dividendYield: num(q.dividendYield) ?? pct(num(q.trailingAnnualDividendYield)),
              marketCap: num(q.marketCap),
            }),
          )
        }
        if (i + 100 < codes.length) await sleep(Math.max(intervalMs, 300))
      }
      return out
    },

    async fetchHistory(code, from): Promise<Bar[]> {
      const c = await client()
      const chart = await c.chart(symbolOf(code), {
        period1: from,
        period2: today(),
        interval: '1d',
      })
      await sleep(intervalMs)
      return chart.quotes
        .filter((q) => q.close != null)
        .map((q) =>
          compact<Bar>({
            asOf: jstDate(q.date),
            close: q.close as number,
            open: num(q.open),
            high: num(q.high),
            low: num(q.low),
            volume: num(q.volume),
          }),
        )
    },

    async fetchFundamentals(codes) {
      const c = await client()
      const out: FundamentalsResult[] = []
      for (const code of codes) {
        try {
          const s = await c.quoteSummary(symbolOf(code), {
            modules: [
              'summaryDetail',
              'defaultKeyStatistics',
              'financialData',
              'calendarEvents',
              'price',
            ],
          })
          const sd = s.summaryDetail ?? {}
          const fd = s.financialData ?? {}
          const ed = s.calendarEvents?.earnings?.earningsDate?.[0]
          const r = compact<FundamentalsResult & { ok: true }>({
            code,
            ok: true,
            per: num(sd.trailingPE),
            forwardPer: num(sd.forwardPE),
            pbr: num(s.defaultKeyStatistics?.priceToBook),
            dividendYield: pct(num(sd.dividendYield)),
            marketCap: num(s.price?.marketCap),
            roe: pct(num(fd.returnOnEquity)),
            operatingMargin: pct(num(fd.operatingMargins)),
            revenueGrowth: pct(num(fd.revenueGrowth)),
            debtToEquity: num(fd.debtToEquity),
            nextEarningsDate: ed ? jstDate(ed) : undefined,
          })
          out.push(r)
        } catch (e) {
          out.push({ code, ok: false, reason: e instanceof Error ? e.message : String(e) })
        }
        await sleep(intervalMs)
      }
      return out
    },

    async fetchFinancials(code): Promise<FinancialsResult> {
      const c = await client()
      const from = jstDate(new Date(now().getTime() - 6 * 365 * 86400_000))
      try {
        const periods: FinancialPeriod[] = []
        for (const type of ['annual', 'quarterly'] as const) {
          const rows = await c.fundamentalsTimeSeries(symbolOf(code), {
            period1: from,
            period2: today(),
            type,
            module: 'all',
          })
          await sleep(intervalMs)
          for (const r of rows) {
            if (num(r.totalRevenue) === undefined && num(r.operatingIncome) === undefined) continue
            const p = compact<FinancialPeriod>({
              periodType: type,
              periodEnd: jstDate(r.date),
              revenue: num(r.totalRevenue),
              operatingIncome: num(r.operatingIncome),
              netIncome: num(r.netIncome),
              totalAssets: num(r.totalAssets),
              equity: num(r.stockholdersEquity),
              operatingCashFlow: num(r.operatingCashFlow),
              eps: num(r.dilutedEPS),
            })
            periods.push(p)
          }
        }
        if (periods.length === 0) return { code, ok: false, reason: 'no financial data' }
        return { code, ok: true, periods }
      } catch (e) {
        return { code, ok: false, reason: e instanceof Error ? e.message : String(e) }
      }
    },
  }
}

export { codeOf as yahooCodeOf, symbolOf as yahooSymbolOf }
