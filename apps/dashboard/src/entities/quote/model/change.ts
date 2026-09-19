import { pctOf } from '../../../shared/lib'

export interface QuotePoint {
  price: number
  previousClose: number | null
}

/** 前日比(%)。前の quote がなければ previousClose を使う */
export function dayChangePct(current: QuotePoint, previous: QuotePoint | undefined): number | null {
  const base = previous?.price ?? current.previousClose ?? null
  return base == null ? null : pctOf(current.price, base)
}
