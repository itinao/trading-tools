import {
  AssessmentBadge,
  type AssessmentView,
  DIRECTION_LABEL,
} from '../../../entities/assessment/index.ts'
import { CategoryBadge } from '../../../entities/disclosure/index.ts'
import { OverrideForm } from '../../../features/override-assessment/index.ts'
import { Icon } from '../../../shared/ui'

export interface DisclosureRow {
  id: number
  disclosedAt: string
  title: string
  pdfUrl: string
  category: string
  assessment?: AssessmentView | null
}

/** 適時開示の一覧（PDF への外部リンク）。判定があれば要約・向き・上書きフォームを出す */
export function DisclosureList({ items }: { items: DisclosureRow[] }) {
  if (items.length === 0) return <p className="empty">ありません。</p>
  return (
    <table>
      <thead>
        <tr>
          <th>日時</th>
          <th className="col-wide">種別</th>
          <th>表題</th>
          <th>判定</th>
        </tr>
      </thead>
      <tbody>
        {items.map((d) => (
          <tr key={d.id}>
            <td className="muted nowrap">{d.disclosedAt.slice(0, 16).replace('T', ' ')}</td>
            <td className="col-wide">
              <CategoryBadge category={d.category} />
              {d.assessment?.direction && d.assessment.direction !== 'none' && (
                <div className="muted">{DIRECTION_LABEL[d.assessment.direction]}</div>
              )}
            </td>
            <td>
              <a href={d.pdfUrl} target="_blank" rel="noreferrer noopener">
                {d.title} <Icon name="open_in_new" className="icon-xs" />
              </a>
              {d.assessment && <div className="muted">{d.assessment.summary}</div>}
            </td>
            <td>
              {d.assessment ? (
                <>
                  <AssessmentBadge a={d.assessment} />
                  <details>
                    <summary className="muted">根拠 / 上書き</summary>
                    <div className="detail-body">{d.assessment.rationale}</div>
                    <OverrideForm assessmentId={d.assessment.id} current={d.assessment.sentiment} />
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
