import { kindLabel } from '../../../entities/action/index.ts'
import { stanceBadgeKind, stanceLabel } from '../../../entities/advice/index.ts'
import { AssessmentBadge } from '../../../entities/assessment/index.ts'
import { dateOnly, pctClass, pctText, price } from '../../../shared/lib'

export interface TimelineRow {
  at: string
  type: 'signal' | 'action' | 'advice' | 'assessment' | 'score' | 'holding'
  title: string
  detail: string | null
  priceAt: number | null
  changeSince: number | null
  meta: Record<string, string | number | null>
}

const TYPE_LABEL: Record<TimelineRow['type'], string> = {
  signal: 'シグナル',
  action: 'アクション',
  advice: '助言',
  assessment: '判定',
  score: 'スコア',
  holding: '保有',
}

function Badge({ e }: { e: TimelineRow }) {
  switch (e.type) {
    case 'signal':
      return (
        <span className={`badge badge-${e.meta.severity === 'critical' ? 'critical' : 'warn'}`}>
          {kindLabel(String(e.meta.kind))}
        </span>
      )
    case 'advice':
      return (
        <span className={`badge badge-${stanceBadgeKind(String(e.meta.stance))}`}>
          {stanceLabel(String(e.meta.stance))}
        </span>
      )
    case 'assessment':
      return (
        <AssessmentBadge
          a={{
            id: Number(e.meta.assessmentId),
            relevance: 'relevant',
            sentiment: Number(e.meta.sentiment),
            impact: Number(e.meta.impact),
            direction: (e.meta.direction as string | null) ?? null,
            summary: '',
            rationale: '',
            author: 'ai',
          }}
        />
      )
    case 'action':
      return (
        <span
          className={`badge badge-${e.meta.status === 'open' ? 'neutral' : e.meta.status === 'done' ? 'primary' : 'neutral'}`}
        >
          {e.detail}
        </span>
      )
    default:
      return <span className="badge badge-neutral">{TYPE_LABEL[e.type]}</span>
  }
}

/** 銘柄の出来事を新しい順に。その日の株価と今との差（Design Doc 0014 §3.1） */
export function Timeline({ events }: { events: TimelineRow[] }) {
  if (events.length === 0) return <p className="empty">出来事はまだない</p>
  return (
    <table>
      <thead>
        <tr>
          <th>日付</th>
          <th>種類</th>
          <th>内容</th>
          <th className="num">その日の株価</th>
          <th className="num">今との差</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e) => (
          <tr key={`${e.at}-${e.type}-${e.title}-${e.detail ?? ''}`}>
            <td className="muted nowrap">{dateOnly(e.at)}</td>
            <td>
              <Badge e={e} />
            </td>
            <td>
              {e.meta.url ? (
                <a href={String(e.meta.url)} target="_blank" rel="noreferrer noopener">
                  {e.title}
                </a>
              ) : (
                e.title
              )}
              {e.type !== 'action' && e.detail && <div className="muted">{e.detail}</div>}
              {e.type === 'action' && e.meta.note && (
                <div className="muted">メモ: {e.meta.note}</div>
              )}
            </td>
            <td className="num">{price(e.priceAt)}</td>
            <td className={`num ${pctClass(e.changeSince)}`}>{pctText(e.changeSince)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
