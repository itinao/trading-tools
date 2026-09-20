import { InstrumentLink } from '../../../entities/instrument/index.ts'
import { scoreClass, scoreText } from '../../../entities/score/index.ts'
import { RemoveWatchButton } from '../../../features/remove-watch/index.ts'
import { dateOnly, price } from '../../../shared/lib'
import { PctCell } from '../../../shared/ui'

export interface WatchRow {
  instrumentId: string
  code: string
  name: string
  addedAt: string | null
  note: string | null
  price: number | null
  priceAsOf: string | null
  drawdownFromHigh60: number | null
  vsMa200: number | null
  score: number | null
  openActions: number
}

export function WatchTable({ rows }: { rows: WatchRow[] }) {
  if (rows.length === 0)
    return (
      <p className="empty">
        ウォッチ銘柄がない。<code>pnpm watch add &lt;code&gt;</code> か、スクリーナーから追加する。
      </p>
    )
  return (
    <table>
      <thead>
        <tr>
          <th>銘柄</th>
          <th>追加</th>
          <th>メモ</th>
          <th className="num">株価</th>
          <th className="num">60 日高値比</th>
          <th className="num">200 日線比</th>
          <th className="num">スコア</th>
          <th className="num">未対応</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.instrumentId}>
            <td>
              <InstrumentLink id={r.instrumentId} name={r.name} code={r.code} />
            </td>
            <td className="muted">{dateOnly(r.addedAt)}</td>
            <td className="muted">{r.note ?? '-'}</td>
            <td className="num">{price(r.price)}</td>
            <PctCell value={r.drawdownFromHigh60} />
            <PctCell value={r.vsMa200} />
            <td className={`num ${scoreClass(r.score)}`}>{scoreText(r.score)}</td>
            <td className="num">{r.openActions}</td>
            <td>
              <RemoveWatchButton code={r.code} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
