export const yen = (n: number | null | undefined) =>
  n == null ? '-' : `${Math.round(n).toLocaleString('ja-JP')}`
export const price = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('ja-JP'))
export const pctText = (n: number | null | undefined) =>
  n == null ? '-' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
/** 損益・変化率の色。楽天証券に合わせ 上昇 = gain（赤）、下落 = loss（緑） */
export const pctClass = (n: number | null | undefined) =>
  n == null ? '' : n < 0 ? 'loss' : n > 0 ? 'gain' : ''
export const dateOnly = (iso: string | null | undefined) => iso?.slice(0, 10) ?? '-'

/** base に対する current の変化率(%)。base が 0 以下なら null */
export function pctOf(current: number, base: number): number | null {
  if (base <= 0) return null
  return Math.round(((current - base) / base) * 10000) / 100
}
