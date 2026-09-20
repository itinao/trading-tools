/** スコアの色分け。閾値は config/detect.json の score_low と揃える（-40 / -60） */
export function scoreClass(score: number | null | undefined): string {
  if (score == null) return ''
  if (score <= -60) return 'critical'
  if (score <= -40) return 'warn'
  return ''
}
export const scoreText = (score: number | null | undefined) =>
  score == null ? '-' : (score > 0 ? '+' : '') + score.toFixed(0)
