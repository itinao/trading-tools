import { pctClass, pctText } from '../../../shared/lib'

export interface FinancialRow {
  periodEnd: string
  revenue: number | null
  operatingIncome: number | null
  netIncome: number | null
  totalAssets: number | null
  equity: number | null
  eps: number | null
}
export interface FundamentalsView {
  asOf: string
  per: number | null
  forwardPer: number | null
  pbr: number | null
  dividendYield: number | null
  roe: number | null
  operatingMargin: number | null
  revenueGrowth: number | null
  debtToEquity: number | null
  nextEarningsDate: string | null
}

const oku = (n: number | null) =>
  n == null ? '-' : `${Math.round(n / 1e8).toLocaleString('ja-JP')}`
const f1 = (n: number | null) => (n == null ? '-' : n.toFixed(1))
const f2 = (n: number | null) => (n == null ? '-' : n.toFixed(2))
const ratio = (a: number | null, b: number | null) =>
  a != null && b && b > 0 ? Math.round((a / b) * 10000) / 100 : null

/** 年次の財務（古い順）と最新の指標。Design Doc 0015 §3.5 */
export function FinancialsTable({
  rows,
  fundamentals,
}: {
  rows: FinancialRow[]
  fundamentals: FundamentalsView | null
}) {
  const asc = [...rows].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
  return (
    <>
      {fundamentals ? (
        <dl className="kv">
          <dt>PER</dt>
          <dd className="num">{f1(fundamentals.per)}</dd>
          <dt>予想 PER</dt>
          <dd className="num">{f1(fundamentals.forwardPer)}</dd>
          <dt>PBR</dt>
          <dd className="num">{f2(fundamentals.pbr)}</dd>
          <dt>配当利回り</dt>
          <dd className="num">
            {fundamentals.dividendYield == null ? '-' : `${f2(fundamentals.dividendYield)}%`}
          </dd>
          <dt>ROE</dt>
          <dd className="num">{fundamentals.roe == null ? '-' : `${f1(fundamentals.roe)}%`}</dd>
          <dt>営業利益率</dt>
          <dd className="num">
            {fundamentals.operatingMargin == null ? '-' : `${f1(fundamentals.operatingMargin)}%`}
          </dd>
          <dt>増収率</dt>
          <dd className="num">
            {fundamentals.revenueGrowth == null ? '-' : `${f1(fundamentals.revenueGrowth)}%`}
          </dd>
          <dt>D/E</dt>
          <dd className="num">{f1(fundamentals.debtToEquity)}</dd>
          <dt>次回決算</dt>
          <dd>{fundamentals.nextEarningsDate ?? '-'}</dd>
          <dt className="muted">取得日</dt>
          <dd className="muted">{fundamentals.asOf}</dd>
        </dl>
      ) : (
        <p className="empty">
          指標はまだありません。<code>pnpm collect fundamentals</code> で取得します。
        </p>
      )}
      <h3>年次の財務（億円）</h3>
      {asc.length === 0 ? (
        <p className="empty">
          財務はまだありません。<code>pnpm collect financials</code> で取得します。
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>期末</th>
              <th className="num">売上</th>
              <th className="num">営業利益</th>
              <th className="num">利益率</th>
              <th className="num">純利益</th>
              <th className="num">総資産</th>
              <th className="num">自己資本</th>
              <th className="num">自己資本比率</th>
              <th className="num">EPS</th>
            </tr>
          </thead>
          <tbody>
            {asc.map((r) => (
              <tr key={r.periodEnd}>
                <td>{r.periodEnd}</td>
                <td className="num">{oku(r.revenue)}</td>
                <td className={`num ${pctClass(r.operatingIncome)}`}>{oku(r.operatingIncome)}</td>
                <td className="num">{pctText(ratio(r.operatingIncome, r.revenue))}</td>
                <td className={`num ${pctClass(r.netIncome)}`}>{oku(r.netIncome)}</td>
                <td className="num">{oku(r.totalAssets)}</td>
                <td className="num">{oku(r.equity)}</td>
                <td className="num">{pctText(ratio(r.equity, r.totalAssets))}</td>
                <td className="num">{f1(r.eps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
