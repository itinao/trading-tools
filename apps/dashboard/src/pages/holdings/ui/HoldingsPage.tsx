import { dateOnly, pctClass, yen } from '../../../shared/lib'
import { HoldingsTable } from '../../../widgets/holdings-table/index.ts'
import type { HoldingsPageData } from '../api/get-holdings-page.ts'

/** 保有一覧。最新スナップショットの銘柄ごとに数量・取得単価・最新株価・前日比・取得単価比・損益 */
export function HoldingsPage({ data }: { data: HoldingsPageData }) {
  const total = data.rows.reduce((s, r) => s + r.marketValue, 0)
  const pnl = data.rows.reduce((s, r) => s + r.unrealizedPnl, 0)
  return (
    <>
      <h1>保有</h1>
      <p className="summary">
        スナップショット: {dateOnly(data.snapshotAsOf)} / 株価: {data.latestQuoteDate ?? 'なし'} /
        評価額 {yen(total)} 円 / 損益 <span className={pctClass(pnl)}>{yen(pnl)} 円</span>
      </p>
      <HoldingsTable rows={data.rows} latestQuoteDate={data.latestQuoteDate} />
    </>
  )
}
