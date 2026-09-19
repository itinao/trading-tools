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
