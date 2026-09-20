import { kindLabel, statusLabel } from '../../../entities/action/index.ts'
import { stanceBadgeKind, stanceLabel } from '../../../entities/advice/index.ts'
import { InstrumentLink } from '../../../entities/instrument/index.ts'
import { dateOnly, pctClass, pctText, price } from '../../../shared/lib'

export interface HistoryRowView {
  actionId: number
  resolvedAt: string
  instrumentId: string
  code: string
  name: string
  kind: string | null
  offense: boolean
  stance: string | null
  status: string
  note: string | null
  priceAtDecision: number | null
  priceNow: number | null
  changeSince: number | null
}

export interface HistorySummaryView {
  key: string
  stance: string
  status: string
  count: number
  medianChange: number | null
}

export function HistorySummary({ summary }: { summary: HistorySummaryView[] }) {
  if (summary.length === 0) return null
  return (
    <table className="compact">
      <thead>
        <tr>
          <th>助言</th>
          <th>判断</th>
          <th className="num">件数</th>
          <th className="num">その後の変化率（中央値）</th>
        </tr>
      </thead>
      <tbody>
        {summary.map((s) => (
          <tr key={s.key}>
            <td>
              {s.stance === 'none' ? (
                <span className="muted">助言なし</span>
              ) : (
                <span className={`badge badge-${stanceBadgeKind(s.stance)}`}>
                  {stanceLabel(s.stance)}
                </span>
              )}
            </td>
            <td>{statusLabel(s.status)}</td>
            <td className="num">{s.count}</td>
            <td className={`num ${pctClass(s.medianChange)}`}>{pctText(s.medianChange)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** 判断の履歴。判断時の株価と今の株価を並べる（Design Doc 0014 §3.2） */
export function HistoryTable({ rows }: { rows: HistoryRowView[] }) {
  if (rows.length === 0)
    return (
      <p className="empty">
        対応した / 見送り
        にしたアクションはまだありません。アクション一覧で状態を変えると、ここに残ります。
      </p>
    )
  return (
    <table>
      <thead>
        <tr>
          <th>判断日</th>
          <th>銘柄</th>
          <th>種類</th>
          <th>助言</th>
          <th>判断</th>
          <th className="num">判断時の株価</th>
          <th className="num">今の株価</th>
          <th className="num">その後</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.actionId}>
            <td className="muted nowrap">{dateOnly(r.resolvedAt)}</td>
            <td>
              <InstrumentLink id={r.instrumentId} name={r.name} code={r.code} />
            </td>
            <td>
              {r.kind ? kindLabel(r.kind) : '-'}
              {r.offense && <div className="muted">攻め</div>}
            </td>
            <td>
              {r.stance ? (
                <span className={`badge badge-${stanceBadgeKind(r.stance)}`}>
                  {stanceLabel(r.stance)}
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td>
              {statusLabel(r.status)}
              {r.note && <div className="muted">{r.note}</div>}
            </td>
            <td className="num">{price(r.priceAtDecision)}</td>
            <td className="num">{price(r.priceNow)}</td>
            <td className={`num ${pctClass(r.changeSince)}`}>{pctText(r.changeSince)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
