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
    <div className="stale">
      株価の最終取得日: {latestQuoteDate ?? 'なし'}（今日は {today}）。`pnpm collect quotes` と
      `pnpm detect run` を実行すると更新される。
    </div>
  )
}
