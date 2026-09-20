/** 取得元のインターフェース。Design Doc 0003 §3.3 / 0010 §3.1 */

export interface Failure {
  code: string
  ok: false
  reason: string
}

export type QuoteResult =
  | { code: string; ok: true; price: number; previousClose?: number; asOf?: string }
  | Failure

/** 日足。asOf は YYYY-MM-DD */
export interface Bar {
  asOf: string
  close: number
  open?: number
  high?: number
  low?: number
  volume?: number
}

export interface QuoteProvider {
  readonly name: string
  fetchQuotes(codes: string[]): Promise<QuoteResult[]>
  /** 日足の遡り取得。from は YYYY-MM-DD。未対応の Provider は省略 */
  fetchHistory?(code: string, from: string): Promise<Bar[]>
}

/** 比率は % の値 */
export interface FundamentalsValues {
  per?: number
  forwardPer?: number
  pbr?: number
  dividendYield?: number
  marketCap?: number
  roe?: number
  operatingMargin?: number
  revenueGrowth?: number
  debtToEquity?: number
  nextEarningsDate?: string
}
export type FundamentalsResult = ({ code: string; ok: true } & FundamentalsValues) | Failure

export interface FundamentalsProvider {
  readonly name: string
  fetchFundamentals(codes: string[]): Promise<FundamentalsResult[]>
}

export interface FinancialPeriod {
  periodType: 'annual' | 'quarterly'
  periodEnd: string
  revenue?: number
  operatingIncome?: number
  netIncome?: number
  totalAssets?: number
  equity?: number
  operatingCashFlow?: number
  eps?: number
}
export type FinancialsResult = { code: string; ok: true; periods: FinancialPeriod[] } | Failure

export interface FinancialsProvider {
  readonly name: string
  fetchFinancials(code: string): Promise<FinancialsResult>
}

export interface NewsItem {
  title: string
  url: string
  /** ISO 8601 */
  publishedAt: string
  publisher?: string
}

export interface NewsProvider {
  readonly name: string
  fetchNews(query: string): Promise<NewsItem[]>
}

export interface DisclosureItem {
  /** 4 桁の証券コード */
  code: string
  companyName: string
  /** ISO 8601 */
  disclosedAt: string
  title: string
  pdfUrl: string
  hasXbrl: boolean
}

export interface DisclosureProvider {
  readonly name: string
  /** その日（YYYY-MM-DD）の開示を全件返す */
  fetchDisclosures(date: string): Promise<DisclosureItem[]>
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export const DEFAULT_HEADERS = { 'user-agent': 'trading-tools/0.1 (personal; +local)' }

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** スクリーニング用の一括の指標。比率は %。Design Doc 0013 §3.5 */
export interface QuoteMetrics {
  code: string
  price: number
  per?: number
  forwardPer?: number
  pbr?: number
  dividendYield?: number
  marketCap?: number
}

export interface QuoteMetricsProvider {
  readonly name: string
  fetchQuoteMetrics(codes: string[]): Promise<QuoteMetrics[]>
}
