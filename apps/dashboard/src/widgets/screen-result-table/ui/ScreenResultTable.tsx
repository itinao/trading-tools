import { AddWatchButton } from '../../../features/add-watch/index.ts'
import { RemoveWatchButton } from '../../../features/remove-watch/index.ts'
import { price } from '../../../shared/lib'

export interface ScreenResultRow {
  rank: number
  code: string
  name: string
  segment: string
  sector33: string | null
  price: number | null
  per: number | null
  forwardPer: number | null
  pbr: number | null
  dividendYield: number | null
  marketCap: number | null
  growthYears: number | null
  /** 保有中 / ウォッチ中 / null */
  status: 'holding' | 'watch' | null
}

const oku = (n: number | null) =>
  n == null ? '-' : `${Math.round(n / 1e8).toLocaleString('ja-JP')} 億`
const f1 = (n: number | null) => (n == null ? '-' : n.toFixed(1))
const f2 = (n: number | null) => (n == null ? '-' : n.toFixed(2))
const SEGMENT_LABEL: Record<string, string> = {
  prime: 'プライム',
  standard: 'スタンダード',
  growth: 'グロース',
  other: 'その他',
}

export function ScreenResultTable({
  rows,
  runId,
  preset,
}: {
  rows: ScreenResultRow[]
  runId: number
  preset: string | null
}) {
  if (rows.length === 0) return <p className="empty">該当する銘柄はありません。</p>
  return (
    <table>
      <thead>
        <tr>
          <th className="num col-wide">#</th>
          <th className="col-name">銘柄</th>
          <th className="col-wide">市場</th>
          <th className="col-wide">業種</th>
          <th className="num">株価</th>
          <th className="num col-wide">PER</th>
          <th className="num col-wide">予想 PER</th>
          <th className="num col-wide">PBR</th>
          <th className="num">配当利回り</th>
          <th className="num col-wide">時価総額</th>
          <th className="num col-wide">増収増益</th>
          <th className="ops">操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.code}>
            <td className="num col-wide">{r.rank}</td>
            <td className="col-name">
              {r.name}
              <div className="muted">{r.code}</div>
            </td>
            <td className="muted col-wide">{SEGMENT_LABEL[r.segment] ?? r.segment}</td>
            <td className="muted col-wide">{r.sector33 ?? '-'}</td>
            <td className="num">{price(r.price)}</td>
            <td className="num col-wide">{f1(r.per)}</td>
            <td className="num col-wide">{f1(r.forwardPer)}</td>
            <td className="num col-wide">{f2(r.pbr)}</td>
            <td className="num">{r.dividendYield == null ? '-' : `${f2(r.dividendYield)}%`}</td>
            <td className="num col-wide">{oku(r.marketCap)}</td>
            <td className="num col-wide">{r.growthYears == null ? '-' : `${r.growthYears} 年`}</td>
            <td className="ops">
              {r.status === 'holding' ? (
                <span className="badge badge-neutral">保有中</span>
              ) : r.status === 'watch' ? (
                <span className="actions">
                  <span className="badge badge-primary">ウォッチ中</span>
                  <RemoveWatchButton code={r.code} />
                </span>
              ) : (
                <AddWatchButton
                  code={r.code}
                  screenRunId={runId}
                  note={preset ? `screen: ${preset}` : 'screen'}
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
