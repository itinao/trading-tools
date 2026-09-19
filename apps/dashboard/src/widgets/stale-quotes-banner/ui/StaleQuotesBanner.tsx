/** 株価が今日の分でないときの警告（Design Doc 0001 R2） */
export function StaleQuotesBanner({
  latestQuoteDate,
  today,
}: {
  latestQuoteDate: string | null
  today: string
}) {
  if (latestQuoteDate != null && latestQuoteDate >= today) return null
  return (
    <div className="banner-stale">
      株価の最終取得日: {latestQuoteDate ?? 'なし'}（今日は {today}）。
      <code>pnpm collect quotes</code> と <code>pnpm detect run</code> を実行すると更新される。
    </div>
  )
}
