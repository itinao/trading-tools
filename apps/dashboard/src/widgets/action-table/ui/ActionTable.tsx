import {
  ActionBody,
  type ActionView,
  kindLabel,
  SeverityBadge,
  statusLabel,
} from '../../../entities/action/index.ts'
import { AdvicePanel, type AdviceView } from '../../../entities/advice/index.ts'
import { InstrumentLink } from '../../../entities/instrument/index.ts'
import { ResolveButtons } from '../../../features/resolve-action/index.ts'
import { dateOnly, pctText } from '../../../shared/lib'

interface Props {
  actions: ActionView[]
  /** ルール生成のアクション id → 助言 */
  advice?: Record<number, AdviceView | null>
  /** 銘柄列を出す（銘柄詳細では不要） */
  showInstrument?: boolean
  /** 状態列を出す（一覧はタブで分かれているので不要） */
  showStatus?: boolean
  /** 状態変更ボタンを出す */
  resolvable?: boolean
  emptyText?: string
}

export function ActionTable({
  actions,
  advice = {},
  showInstrument = true,
  showStatus = false,
  resolvable = true,
  emptyText = 'なし',
}: Props) {
  if (actions.length === 0) return <p className="muted">{emptyText}</p>
  return (
    <table>
      <thead>
        <tr>
          {showStatus && <th>状態</th>}
          <th>重大度</th>
          {showInstrument && <th>銘柄</th>}
          <th>内容</th>
          <th className="num">値</th>
          <th>助言</th>
          <th>作成</th>
          {showStatus && <th>対応</th>}
          {resolvable && <th>操作</th>}
        </tr>
      </thead>
      <tbody>
        {actions.map((a) => (
          <tr key={a.id}>
            {showStatus && <td>{statusLabel(a.status)}</td>}
            <td>
              <SeverityBadge severity={a.severity} fallback={a.origin} />
            </td>
            {showInstrument && (
              <td>
                <InstrumentLink id={a.instrumentId} name={a.name} code={a.code} />
              </td>
            )}
            <td>
              <ActionBody title={a.title} body={a.body} note={a.note} />
            </td>
            <td className="num">{a.kind ? `${kindLabel(a.kind)} ${pctText(a.value)}` : '-'}</td>
            <td>
              <AdvicePanel advice={advice[a.id] ?? null} />
            </td>
            <td className="muted">{dateOnly(a.createdAt)}</td>
            {showStatus && <td className="muted">{dateOnly(a.resolvedAt)}</td>}
            {resolvable && (
              <td>
                <ResolveButtons id={a.id} status={a.status} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
