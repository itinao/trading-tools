import { Link } from '@tanstack/react-router'
import { ScreenResultTable } from '../../../widgets/screen-result-table/index.ts'
import type { ScreenerPageData } from '../api/get-screener-page.ts'

/** スクリーナー。CLI（pnpm screen run）の実行結果を見て、候補をウォッチに追加する。実行は画面からは行わない */
export function ScreenerPage({ data }: { data: ScreenerPageData }) {
  return (
    <>
      <h1>スクリーナー</h1>
      {data.runs.length === 0 ? (
        <p className="empty">
          実行結果がない。<code>pnpm collect universe</code> のあと{' '}
          <code>pnpm screen run --preset value</code> で実行する。
        </p>
      ) : (
        <>
          <div className="tabs">
            {data.runs.map((r) => (
              <Link
                key={r.id}
                to="/screener"
                search={{ run: r.id }}
                className={r.id === data.run?.id ? 'active' : ''}
              >
                #{r.id} {r.preset ?? '条件指定'} ({r.matched})
              </Link>
            ))}
          </div>
          {data.run && (
            <p className="summary">
              実行 {data.run.executedAt.slice(0, 16).replace('T', ' ')} / 母集団{' '}
              {data.run.universeSize.toLocaleString('ja-JP')} 銘柄 → {data.run.matched} 件 / 条件{' '}
              <code>{data.run.criteriaJson}</code>
            </p>
          )}
          <ScreenResultTable
            rows={data.rows}
            runId={data.run?.id ?? 0}
            preset={data.run?.preset ?? null}
          />
        </>
      )}
      <p className="note">
        スクリーニングの実行は CLI から（Yahoo
        への負荷を画面操作で増やさない）。結果からウォッチに追加すると、翌日から監視と検知の対象になる。
      </p>
    </>
  )
}
