import { sentimentBadgeKind, sentimentLabel } from '../model/labels.ts'

export interface AssessmentView {
  id: number
  relevance: string
  sentiment: number
  impact: number
  direction: string | null
  summary: string
  rationale: string
  author: string
}

/** 判定のバッジ。relevant でなければ「無関係」 */
export function AssessmentBadge({ a }: { a: AssessmentView }) {
  const kind = sentimentBadgeKind(a.relevance, a.sentiment)
  const text =
    a.relevance === 'relevant' ? `${sentimentLabel(a.sentiment)} / 影響 ${a.impact}` : '無関係'
  return (
    <span
      className={`badge badge-${kind}`}
      title={a.author === 'human' ? '人が上書き' : 'AI の判定'}
    >
      {text}
      {a.author === 'human' ? ' ✎' : ''}
    </span>
  )
}
