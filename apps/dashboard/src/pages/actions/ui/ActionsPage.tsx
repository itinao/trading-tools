import { Link } from '@tanstack/react-router'
import { ACTION_STATUSES, STATUS_LABEL } from '../../../entities/action/index.ts'
import { ActionTable } from '../../../widgets/action-table/index.ts'
import { StaleQuotesBanner } from '../../../widgets/stale-quotes-banner/index.ts'
import type { ActionsPageData } from '../api/get-actions-page.ts'

/** アクション一覧。未対応 / 対応した / 見送り をタブで切り替え、対応した・見送りにできる。株価が古ければ警告 */
export function ActionsPage({ data }: { data: ActionsPageData }) {
  return (
    <>
      <h1>アクション</h1>
      <StaleQuotesBanner latestQuoteDate={data.latestQuoteDate} today={data.today} />
      <div className="tabs">
        {ACTION_STATUSES.map((s) => (
          <Link key={s} to="/" search={{ status: s }} className={s === data.status ? 'active' : ''}>
            {STATUS_LABEL[s]} ({data.counts[s]})
          </Link>
        ))}
      </div>
      <ActionTable
        actions={data.actions}
        advice={data.advice}
        emptyText={`${STATUS_LABEL[data.status]}のアクションはない。`}
      />
      <p className="note">アクションは事実の整理。売る / 持つの最終判断は人が行う。</p>
    </>
  )
}
