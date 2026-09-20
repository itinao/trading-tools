import { Link } from '@tanstack/react-router'
import { Icon, Logo } from '../../../shared/ui'

export interface SidebarData {
  today: string
  status: {
    latestQuoteDate: string | null
    openActions: { holding: number; watch: number; total: number }
    pendingAssessments: number
    monitored: { holding: number; watch: number }
  }
  lastCollect: { date: string; finishedAt: string | null; status: number | null } | null
}

const ITEMS = [
  {
    to: '/',
    label: 'アクション',
    hint: '毎朝の入口。検知と助言の確認',
    exact: true,
    icon: 'inbox',
  },
  {
    to: '/instruments',
    label: '銘柄',
    hint: '監視中の銘柄（保有 / ウォッチ）',
    exact: false,
    icon: 'visibility',
  },
  {
    to: '/screener',
    label: 'スクリーナー',
    hint: '候補を探してウォッチへ',
    exact: false,
    icon: 'filter_alt',
  },
  { to: '/history', label: '履歴', hint: '判断の記録（全銘柄）', exact: false, icon: 'history' },
] as const

/** 月日だけ（YYYY-MM-DD → MM-DD）。サイドバーの幅に収めるため */
const monthDay = (date: string) => date.slice(5)

/**
 * 左固定のナビ。上にロゴ、中に 4 項目 + 1 行の説明と未対応の件数、下にサイト全体の更新情報
 * （株価の鮮度、最終収集）。画面固有の更新情報はここではなくページのヘッダ帯の右に置く（Design Doc 0015 §3.1 / 補足）
 */
export function Sidebar({ data }: { data: SidebarData }) {
  const stale = data.status.latestQuoteDate == null || data.status.latestQuoteDate < data.today
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link to="/" className="logo-link">
          <Logo />
        </Link>
      </div>
      <nav className="sidebar-nav">
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact, includeSearch: false }}
            className="sidebar-item"
          >
            <span className="sidebar-label">
              <Icon name={item.icon} />
              {item.label}
              {item.to === '/' && data.status.openActions.total > 0 && (
                <span className="badge badge-critical">{data.status.openActions.total}</span>
              )}
            </span>
            <span className="sidebar-hint">{item.hint}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-status">
        <div
          className={stale ? 'stale' : ''}
          title={`株価の最新日 ${data.status.latestQuoteDate ?? 'なし'}`}
        >
          <Icon name={stale ? 'schedule' : 'check_circle'} className="icon-sm" />
          株価 {data.status.latestQuoteDate ? monthDay(data.status.latestQuoteDate) : 'なし'}
          {stale ? `（今日は ${monthDay(data.today)}）` : '（今日）'}
        </div>
        <div
          className={data.lastCollect?.status ? 'stale' : ''}
          title={
            data.lastCollect
              ? `最終収集 ${data.lastCollect.date}`
              : '自動収集は未登録（pnpm schedule install）'
          }
        >
          <Icon name="cloud_download" className="icon-sm" />
          {data.lastCollect ? (
            <>
              収集 {monthDay(data.lastCollect.date)}
              {data.lastCollect.finishedAt ? ` ${data.lastCollect.finishedAt.slice(11, 16)}` : ''}
              {data.lastCollect.status === 0
                ? ''
                : data.lastCollect.status == null
                  ? '（実行中）'
                  : `（失敗 ${data.lastCollect.status}）`}
            </>
          ) : (
            '収集 未登録'
          )}
        </div>
      </div>
    </aside>
  )
}
