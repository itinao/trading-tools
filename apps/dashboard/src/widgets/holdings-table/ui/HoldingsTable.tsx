import { InstrumentLink } from '../../../entities/instrument/index.ts'
import { scoreClass, scoreText } from '../../../entities/score/index.ts'
import { price } from '../../../shared/lib'
import { PctCell, YenCell } from '../../../shared/ui'

export interface HoldingRow {
  instrumentId: string
  code: string
  name: string
  quantity: number
  averageCost: number
  price: number | null
  priceAsOf: string | null
  dayChangePct: number | null
  score: number | null
  costChangePct: number | null
  marketValue: number
  unrealizedPnl: number
}

export function HoldingsTable({
  rows,
  latestQuoteDate,
}: {
  rows: HoldingRow[]
  latestQuoteDate: string | null
}) {
  if (rows.length === 0)
    return (
      <p className="empty">
        保有はありません。<code>pnpm import-holdings run</code> で取り込みます。
      </p>
    )
  return (
    <table>
      <thead>
        <tr>
          <th className="col-name">銘柄</th>
          <th className="num col-wide">数量</th>
          <th className="num col-wide">取得単価</th>
          <th className="num">株価</th>
          <th className="num">前日比</th>
          <th className="num col-wide">取得単価比</th>
          <th className="num col-wide">評価額</th>
          <th className="num">損益</th>
          <th className="num col-wide">スコア</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.instrumentId}>
            <td className="col-name">
              <InstrumentLink id={r.instrumentId} name={r.name} code={r.code} />
            </td>
            <td className="num col-wide">{r.quantity.toLocaleString('ja-JP')}</td>
            <td className="num col-wide">{price(Math.round(r.averageCost * 100) / 100)}</td>
            <td className="num">
              {price(r.price)}
              {r.priceAsOf && r.priceAsOf !== latestQuoteDate && (
                <div className="muted">{r.priceAsOf}</div>
              )}
            </td>
            <PctCell value={r.dayChangePct} />
            <PctCell value={r.costChangePct} className="col-wide" />
            <YenCell value={r.marketValue} className="col-wide" />
            <YenCell value={r.unrealizedPnl} signed />
            <td className={`num col-wide ${scoreClass(r.score)}`}>{scoreText(r.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
