import { Link } from '@tanstack/react-router'
import { Icon } from '../../../shared/ui'

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
    hint: '毎朝の入口。検知と助言を確認して処理する',
    exact: true,
    icon: 'inbox',
  },
  {
    to: '/instruments',
    label: '銘柄',
    hint: '監視している銘柄（保有 / ウォッチ）',
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

/** 左固定のナビ。4 項目 + 1 行の説明、未対応の件数、株価の鮮度、最終収集（Design Doc 0015 §3.1） */
export function Sidebar({ data }: { data: SidebarData }) {
  const stale = data.status.latestQuoteDate == null || data.status.latestQuoteDate < data.today
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-title">trading-tools</div>
        <div className={`sidebar-fresh ${stale ? 'stale' : ''}`}>
          <Icon name={stale ? 'schedule' : 'check_circle'} className="icon-sm" /> 株価:{' '}
          {data.status.latestQuoteDate ?? 'なし'}
          {stale ? `（今日は ${data.today}）` : '（今日）'}
        </div>
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
      <div className="sidebar-foot muted">
        {data.lastCollect ? (
          <>
            最終収集 {data.lastCollect.date}
            {data.lastCollect.finishedAt ? ` ${data.lastCollect.finishedAt.slice(11, 16)}` : ''}{' '}
            {data.lastCollect.status === 0
              ? '✓'
              : data.lastCollect.status == null
                ? '（実行中）'
                : `✗ status=${data.lastCollect.status}`}
          </>
        ) : (
          <>
            自動収集は未登録（<code>pnpm schedule install</code>）
          </>
        )}
      </div>
    </aside>
  )
}
