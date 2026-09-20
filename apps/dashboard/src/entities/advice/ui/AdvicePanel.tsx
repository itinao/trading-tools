import { stanceBadgeKind, stanceLabel } from '../model/labels.ts'

export interface AdviceView {
  actionId: number
  stance: string
  title: string
  markdown: string
  references: { type: string; id?: number; label: string; url?: string }[]
  model: string | null
  createdAt: string
}

/** 助言。stance のバッジとタイトル、折りたたみで本文と参照。免責を常時表示 */
export function AdvicePanel({ advice }: { advice: AdviceView | null }) {
  if (!advice) return <span className="muted">未</span>
  return (
    <div className="advice">
      <span className={`badge badge-${stanceBadgeKind(advice.stance)}`}>
        {stanceLabel(advice.stance)}
      </span>{' '}
      {advice.title}
      <details>
        <summary className="muted">本文 / 参照</summary>
        <div className="detail-body markdown">{advice.markdown}</div>
        {advice.references.length > 0 && (
          <ul className="references">
            {advice.references.map((r, i) => (
              <li key={`${r.type}-${r.id ?? i}`}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer noopener">
                    {r.label}
                  </a>
                ) : (
                  r.label
                )}
              </li>
            ))}
          </ul>
        )}
      </details>
      <div className="note">
        AI の助言（{advice.model ?? 'model 不明'}）です。判断材料であり、最終判断は人が行います。
      </div>
    </div>
  )
}
