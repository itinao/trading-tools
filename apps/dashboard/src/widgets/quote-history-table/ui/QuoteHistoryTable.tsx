import { dayChangePct, type QuotePoint } from '../../../entities/quote/index.ts'
import { price } from '../../../shared/lib'
import { PctCell } from '../../../shared/ui'

export interface QuoteRow extends QuotePoint {
  id: number
  asOf: string
  source: string
}

/** 新しい順に並んだ株価の表。前日比は次の行（前日）と比べる */
export function QuoteHistoryTable({ quotes }: { quotes: QuoteRow[] }) {
  if (quotes.length === 0) return <p className="muted">なし</p>
  return (
    <table>
      <thead>
        <tr>
          <th>日付</th>
          <th className="num">株価</th>
          <th className="num">前日比</th>
          <th>取得元</th>
        </tr>
      </thead>
      <tbody>
        {quotes.map((q, i) => (
          <tr key={q.id}>
            <td>{q.asOf}</td>
            <td className="num">{price(q.price)}</td>
            <PctCell value={dayChangePct(q, quotes[i + 1])} />
            <td className="muted">{q.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
