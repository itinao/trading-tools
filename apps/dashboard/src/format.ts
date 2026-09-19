export const yen = (n: number | null | undefined) =>
  n == null ? '-' : `${Math.round(n).toLocaleString('ja-JP')}`
export const price = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('ja-JP'))
export const pctText = (n: number | null | undefined) =>
  n == null ? '-' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
export const pctClass = (n: number | null | undefined) =>
  n == null ? '' : n < 0 ? 'down' : n > 0 ? 'up' : ''
export const KIND_LABEL: Record<string, string> = {
  price_drop_cost: '取得単価比',
  drawdown_60d: '直近高値比',
  below_ma200: '200日線割れ',
  price_drop_day: '前日比',
}
export const STATUS_LABEL = { open: '未対応', done: '対応した', dismissed: '見送り' } as const
