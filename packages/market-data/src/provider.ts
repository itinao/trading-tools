/** 株価の取得元。Design Doc 0003 §3.3 */
export interface QuoteProvider {
  readonly name: string
  /** codes は証券コード（例 '7203'）。asOf は YYYY-MM-DD */
  fetchQuotes(codes: string[], asOf: string): Promise<QuoteResult[]>
}

export type QuoteResult =
  | { code: string; ok: true; price: number; previousClose?: number }
  | { code: string; ok: false; reason: string }
