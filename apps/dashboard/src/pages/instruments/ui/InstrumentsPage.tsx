import { Link } from '@tanstack/react-router'
import { dateOnly, pctClass, yen } from '../../../shared/lib'
import { HoldingsTable } from '../../../widgets/holdings-table/index.ts'
import { WatchTable } from '../../../widgets/watch-table/index.ts'
import type { InstrumentsPageData } from '../api/get-instruments-page.ts'

export type InstrumentsTab = 'holding' | 'watch'

/** 銘柄。監視している銘柄の一覧を 保有 / ウォッチ のタブで切り替える。ウォッチはスクリーナーから追加できる */
export function InstrumentsPage({ data, tab }: { data: InstrumentsPageData; tab: InstrumentsTab }) {
  const total = data.holdings.reduce((s, r) => s + r.marketValue, 0)
  const pnl = data.holdings.reduce((s, r) => s + r.unrealizedPnl, 0)
  return (
    <>
      <header className="page-header">
        <div>
          <h1>銘柄</h1>
          <p className="summary">
            監視している銘柄: 保有 {data.holdings.length} / ウォッチ {data.watches.length} / 株価{' '}
            {data.latestQuoteDate ?? 'なし'}
          </p>
        </div>
        <div className="page-actions">
          <Link to="/screener">スクリーナーで探す →</Link>
        </div>
      </header>
      <div className="tabs">
        <Link
          to="/instruments"
          search={{}}
          activeOptions={{ exact: true }}
          className={tab === 'holding' ? 'active' : ''}
        >
          保有 ({data.holdings.length})
        </Link>
        <Link
          to="/instruments"
          search={{ tab: 'watch' }}
          activeOptions={{ exact: true }}
          className={tab === 'watch' ? 'active' : ''}
        >
          ウォッチ ({data.watches.length})
        </Link>
      </div>
      {tab === 'holding' ? (
        <>
          <p className="summary">
            スナップショット {dateOnly(data.snapshotAsOf)} / 評価額 {yen(total)} 円 / 損益{' '}
            <span className={pctClass(pnl)}>{yen(pnl)} 円</span>
          </p>
          <HoldingsTable rows={data.holdings} latestQuoteDate={data.latestQuoteDate} />
        </>
      ) : (
        <WatchTable rows={data.watches} />
      )}
    </>
  )
}
