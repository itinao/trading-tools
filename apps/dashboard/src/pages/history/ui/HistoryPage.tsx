import { Link } from '@tanstack/react-router'
import { HistorySummary, HistoryTable } from '../../../widgets/history-table/index.ts'
import type { HistoryPageData } from '../api/get-history-page.ts'

const RANGES = [
  { label: '30 日', days: 30 },
  { label: '90 日', days: 90 },
  { label: '1 年', days: 365 },
  { label: 'すべて', days: null },
]
const sinceOf = (days: number | null) => {
  if (days == null) return undefined
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** 判断の履歴。対応した / 見送りにしたアクションと、判断時の株価とその後の変化。stance × 判断の集計 */
export function HistoryPage({ data }: { data: HistoryPageData }) {
  return (
    <>
      <h1>履歴</h1>
      <div className="tabs">
        {RANGES.map((r) => {
          const since = sinceOf(r.days)
          const active = (data.since ?? undefined) === since
          return (
            <Link
              key={r.label}
              to="/history"
              activeOptions={{ exact: true }}
              search={since ? { since } : {}}
              className={active ? 'active' : ''}
            >
              {r.label}
            </Link>
          )
        })}
      </div>
      <HistorySummary summary={data.summary} />
      <h2>判断</h2>
      <HistoryTable rows={data.rows} />
      <p className="note">
        「その後」は株価の変化率だけで、判断の良し悪しはそれだけでは決まらない。「対応した」に何をしたか（売った
        / 買った / 確認した）をメモに書く運用にすると、振り返りに使える。
      </p>
    </>
  )
}
