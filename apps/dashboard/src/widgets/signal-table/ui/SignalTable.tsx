import { kindLabel } from '../../../entities/action/index.ts'
import { PctCell } from '../../../shared/ui'

export interface SignalRow {
  id: number
  asOf: string
  kind: string
  severity: string
  value: number
}

export function SignalTable({ signals }: { signals: SignalRow[] }) {
  if (signals.length === 0) return <p className="empty">ありません。</p>
  return (
    <table>
      <thead>
        <tr>
          <th>日付</th>
          <th>種類</th>
          <th>重大度</th>
          <th className="num">値</th>
        </tr>
      </thead>
      <tbody>
        {signals.map((s) => (
          <tr key={s.id}>
            <td>{s.asOf}</td>
            <td>{kindLabel(s.kind)}</td>
            <td>
              <span className={`badge badge-${s.severity}`}>{s.severity}</span>
            </td>
            <PctCell value={s.value} />
          </tr>
        ))}
      </tbody>
    </table>
  )
}
