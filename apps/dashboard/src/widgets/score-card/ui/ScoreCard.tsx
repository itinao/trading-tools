import { scoreClass, scoreText } from '../../../entities/score/index.ts'

export interface ScoreView {
  asOf: string
  score: number
  components: { assessment: number; price: number; financials: number; notes: string[] }
}

/** スコアと内訳（判定 / 株価 / 財務）。Design Doc 0011 §3.4 */
export function ScoreCard({ score }: { score: ScoreView | null }) {
  if (!score) return <p className="empty">スコアはまだない。`pnpm detect run` で計算される。</p>
  const c = score.components
  return (
    <div className="score-card">
      <div className={`score-value ${scoreClass(score.score)}`}>{scoreText(score.score)}</div>
      <dl className="score-components">
        <dt>判定</dt>
        <dd className="num">{scoreText(c.assessment)}</dd>
        <dt>株価</dt>
        <dd className="num">{scoreText(c.price)}</dd>
        <dt>財務</dt>
        <dd className="num">{scoreText(c.financials)}</dd>
      </dl>
      <div className="muted">
        {score.asOf}
        {c.notes.length > 0 ? ` / ${c.notes.join('、')}` : ''}
      </div>
    </div>
  )
}
