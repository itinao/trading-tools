export const SENTIMENTS = [-2, -1, 0, 1, 2] as const
export const SENTIMENT_LABEL: Record<number, string> = {
  '-2': '悪材料（大）',
  '-1': '悪材料（小）',
  '0': '中立',
  '1': '好材料（小）',
  '2': '好材料（大）',
}
export const DIRECTION_LABEL: Record<string, string> = { up: '上方', down: '下方', none: '—' }

export function sentimentLabel(s: number): string {
  return SENTIMENT_LABEL[s] ?? String(s)
}
/** 判定の色: 悪材料は critical/warn、好材料は gain 系、irrelevant は neutral */
export function sentimentBadgeKind(
  relevance: string,
  sentiment: number,
): 'critical' | 'warn' | 'primary' | 'neutral' {
  if (relevance !== 'relevant') return 'neutral'
  if (sentiment <= -2) return 'critical'
  if (sentiment === -1) return 'warn'
  if (sentiment >= 1) return 'primary'
  return 'neutral'
}
