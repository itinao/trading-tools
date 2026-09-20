import { AssessmentBadge, type AssessmentView } from '../../../entities/assessment/index.ts'
import { OverrideForm } from '../../../features/override-assessment/index.ts'

export interface NewsRow {
  id: number
  publishedAt: string
  title: string
  url: string
  publisher: string | null
  assessment?: AssessmentView | null
}

/** ニュースの見出し一覧（外部リンク）。判定があれば要約と上書きフォームを出す */
export function NewsList({ items }: { items: NewsRow[] }) {
  if (items.length === 0) return <p className="empty">なし</p>
  return (
    <table>
      <thead>
        <tr>
          <th>日時</th>
          <th>見出し</th>
          <th>媒体</th>
          <th>判定</th>
        </tr>
      </thead>
      <tbody>
        {items.map((n) => (
          <tr key={n.id}>
            <td className="muted nowrap">{n.publishedAt.slice(0, 16).replace('T', ' ')}</td>
            <td>
              <a href={n.url} target="_blank" rel="noreferrer noopener">
                {n.title}
              </a>
              {n.assessment && <div className="muted">{n.assessment.summary}</div>}
            </td>
            <td className="muted">{n.publisher ?? '-'}</td>
            <td>
              {n.assessment ? (
                <>
                  <AssessmentBadge a={n.assessment} />
                  <details>
                    <summary className="muted">根拠 / 上書き</summary>
                    <div className="detail-body">{n.assessment.rationale}</div>
                    <OverrideForm assessmentId={n.assessment.id} current={n.assessment.sentiment} />
                  </details>
                </>
              ) : (
                <span className="muted">未判定</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
