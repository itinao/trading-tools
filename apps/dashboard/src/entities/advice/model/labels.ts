export const STANCE_LABEL: Record<string, string> = {
  hold: '保有継続',
  review: '要確認',
  reduce: '縮小を検討',
  candidate: '候補',
  pass: '見送り',
}
export function stanceLabel(s: string): string {
  return STANCE_LABEL[s] ?? s
}
/** stance の色: hold は neutral、review は primary、reduce は warn（Design Doc 0012 §3.4） */
export function stanceBadgeKind(s: string): 'neutral' | 'primary' | 'warn' {
  if (s === 'reduce') return 'warn'
  if (s === 'review' || s === 'candidate') return 'primary'
  return 'neutral'
}
