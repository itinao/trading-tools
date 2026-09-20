import { WatchTable } from '../../../widgets/watch-table/index.ts'
import type { WatchPageData } from '../api/get-watch-page.ts'

/** ウォッチ一覧。まだ持っていないが監視している銘柄の株価の位置・スコア・未対応アクション。外す操作 */
export function WatchPage({ data }: { data: WatchPageData }) {
  return (
    <>
      <h1>ウォッチ</h1>
      <p className="summary">
        株価: {data.latestQuoteDate ?? 'なし'} / {data.rows.length} 銘柄
      </p>
      <WatchTable rows={data.rows} />
    </>
  )
}
