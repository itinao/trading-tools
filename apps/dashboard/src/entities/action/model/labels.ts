import type { ActionStatus } from '@trading/domain'

export const ACTION_STATUSES: readonly ActionStatus[] = ['open', 'done', 'dismissed']
export const STATUS_LABEL: Record<ActionStatus, string> = {
  open: '未対応',
  done: '対応した',
  dismissed: '見送り',
}
export const KIND_LABEL: Record<string, string> = {
  price_drop_cost: '取得単価比',
  drawdown_60d: '直近高値比',
  below_ma200: '200日線割れ',
  price_drop_day: '前日比',
  news_negative: '悪材料ニュース',
  forecast_down: '業績予想の下方修正',
  dividend_cut: '減配・無配',
  margin_deterioration: '営業利益率の悪化',
  equity_ratio_drop: '自己資本比率の低下',
  score_low: 'スコア低下',
}

export function isActionStatus(value: unknown): value is ActionStatus {
  return ACTION_STATUSES.includes(value as ActionStatus)
}
export function statusLabel(status: string): string {
  return isActionStatus(status) ? STATUS_LABEL[status] : status
}
export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind
}
