export interface StatusStripData {
  today: string
  latestQuoteDate: string | null
  pendingAssessments: number
  openActions: { holding: number; watch: number; total: number }
  lastCollect: { date: string; finishedAt: string | null; status: number | null } | null
}

/** 状態の帯。毎朝の確認の先頭（Design Doc 0015 §3.3） */
export function StatusStrip({ data }: { data: StatusStripData }) {
  const stale = data.latestQuoteDate == null || data.latestQuoteDate < data.today
  return (
    <div className="status-strip">
      <div className={`status-cell ${stale ? 'stale' : ''}`}>
        <div className="status-label">株価</div>
        <div className="status-value">{data.latestQuoteDate ?? 'なし'}</div>
        {stale && (
          <div className="muted">
            <code>pnpm collect all</code> → <code>pnpm detect run</code>
          </div>
        )}
      </div>
      <div
        className={`status-cell ${data.lastCollect && data.lastCollect.status !== 0 && data.lastCollect.status != null ? 'stale' : ''}`}
      >
        <div className="status-label">最終収集</div>
        <div className="status-value">
          {data.lastCollect
            ? `${data.lastCollect.date} ${data.lastCollect.status === 0 ? '✓' : data.lastCollect.status == null ? '実行中' : '✗'}`
            : '未登録'}
        </div>
      </div>
      <div className={`status-cell ${data.pendingAssessments > 0 ? 'attention' : ''}`}>
        <div className="status-label">未判定</div>
        <div className="status-value">{data.pendingAssessments.toLocaleString('ja-JP')}</div>
        {data.pendingAssessments > 0 && <div className="muted">「朝の確認をして」で減る</div>}
      </div>
      <div className="status-cell">
        <div className="status-label">未対応</div>
        <div className="status-value">{data.openActions.total}</div>
        <div className="muted">
          保有 {data.openActions.holding} / ウォッチ {data.openActions.watch}
        </div>
      </div>
    </div>
  )
}
