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
        保有がない。<code>pnpm import-holdings run</code> で取り込む。
      </p>
    )
  return (
    <table>
      <thead>
        <tr>
          <th>銘柄</th>
          <th className="num">数量</th>
          <th className="num">取得単価</th>
          <th className="num">株価</th>
          <th className="num">前日比</th>
          <th className="num">取得単価比</th>
          <th className="num">評価額</th>
          <th className="num">損益</th>
          <th className="num">スコア</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.instrumentId}>
            <td>
              <InstrumentLink id={r.instrumentId} name={r.name} code={r.code} />
            </td>
            <td className="num">{r.quantity.toLocaleString('ja-JP')}</td>
            <td className="num">{price(Math.round(r.averageCost * 100) / 100)}</td>
            <td className="num">
              {price(r.price)}
              {r.priceAsOf && r.priceAsOf !== latestQuoteDate && (
                <div className="muted">{r.priceAsOf}</div>
              )}
            </td>
            <PctCell value={r.dayChangePct} />
            <PctCell value={r.costChangePct} />
            <YenCell value={r.marketValue} />
            <YenCell value={r.unrealizedPnl} signed />
            <td className={`num ${scoreClass(r.score)}`}>{scoreText(r.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
