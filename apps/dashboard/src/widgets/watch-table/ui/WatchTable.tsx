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
        ウォッチ銘柄はありません。<code>pnpm watch add &lt;code&gt;</code>{' '}
        か、スクリーナーから追加してください。
      </p>
    )
  return (
    <table>
      <thead>
        <tr>
          <th className="col-name">銘柄</th>
          <th className="col-wide">追加</th>
          <th className="col-wide">メモ</th>
          <th className="num">株価</th>
          <th className="num col-wide">60 日高値比</th>
          <th className="num col-wide">200 日線比</th>
          <th className="num">スコア</th>
          <th className="num col-wide">未対応</th>
          <th className="ops">操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.instrumentId}>
            <td className="col-name">
              <InstrumentLink id={r.instrumentId} name={r.name} code={r.code} />
            </td>
            <td className="muted col-wide">{dateOnly(r.addedAt)}</td>
            <td className="muted col-wide">{r.note ?? '-'}</td>
            <td className="num">{price(r.price)}</td>
            <PctCell value={r.drawdownFromHigh60} className="col-wide" />
            <PctCell value={r.vsMa200} className="col-wide" />
            <td className={`num ${scoreClass(r.score)}`}>{scoreText(r.score)}</td>
            <td className="num col-wide">{r.openActions}</td>
            <td className="ops">
              <RemoveWatchButton code={r.code} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
