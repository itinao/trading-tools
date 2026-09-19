export const yen = (n: number | null | undefined) =>
  n == null ? '-' : `${Math.round(n).toLocaleString('ja-JP')}`
export const price = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('ja-JP'))
export const pctText = (n: number | null | undefined) =>
  n == null ? '-' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
export const pctClass = (n: number | null | undefined) =>
  n == null ? '' : n < 0 ? 'down' : n > 0 ? 'up' : ''
export const dateOnly = (iso: string | null | undefined) => iso?.slice(0, 10) ?? '-'

/** base に対する current の変化率(%)。base が 0 以下なら null */
export function pctOf(current: number, base: number): number | null {
  if (base <= 0) return null
  return Math.round(((current - base) / base) * 10000) / 100
}
