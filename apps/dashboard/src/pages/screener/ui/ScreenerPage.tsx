import { Link } from '@tanstack/react-router'
import { ScreenResultTable } from '../../../widgets/screen-result-table/index.ts'
import type { ScreenerPageData } from '../api/get-screener-page.ts'
import { describeCriteria, PRESET_DESCRIPTION, PRESET_LABEL } from '../lib/presets.ts'

/** スクリーナー。CLI（pnpm screen run）の実行結果を見て、候補をウォッチに追加する。実行は画面からは行わない */
export function ScreenerPage({ data }: { data: ScreenerPageData }) {
  const run = data.run
  return (
    <>
      <header className="page-header">
        <div>
          <h1>スクリーナー</h1>
          <p className="summary">
            東証の上場銘柄から、条件（プリセット）に合う銘柄を絞った結果です。
            <br />
            気になる銘柄をウォッチに追加すると、翌日から監視と検知の対象になります。
            <br />
            実行は CLI（<code>pnpm screen run</code>）から行います。
          </p>
        </div>
      </header>
      {data.runs.length === 0 ? (
        <p className="empty">
          実行結果がありません。<code>pnpm collect universe</code> のあと{' '}
          <code>pnpm screen run --preset value</code> で実行してください。
        </p>
      ) : (
        <>
          <div className="tabs">
            {data.runs.map((r) => (
              <Link
                key={r.id}
                to="/screener"
                activeOptions={{ exact: true }}
                search={{ run: r.id }}
                className={r.id === run?.id ? 'active' : ''}
              >
                #{r.id} {r.preset ? (PRESET_LABEL[r.preset] ?? r.preset) : '条件指定'}{' '}
                {r.preset && PRESET_LABEL[r.preset] && <span className="muted">{r.preset}</span>} (
                {r.matched})
              </Link>
            ))}
          </div>
          {run && (
            <>
              <p className="run-meta">
                {run.preset && (
                  <span>
                    <b>{PRESET_LABEL[run.preset] ?? run.preset}</b>:{' '}
                    {PRESET_DESCRIPTION[run.preset] ?? 'config/screen.json のプリセットです'}
                  </span>
                )}
                <span>実行 {run.executedAt.slice(0, 16).replace('T', ' ')}</span>
                <span>
                  母集団 {run.universeSize.toLocaleString('ja-JP')} 銘柄 → {run.matched} 件
                </span>
              </p>
              <p className="run-meta">
                <span className="criteria">
                  <b>条件</b>
                  {describeCriteria(run.criteriaJson).map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </span>
              </p>
            </>
          )}
          <ScreenResultTable rows={data.rows} runId={run?.id ?? 0} preset={run?.preset ?? null} />
        </>
      )}
      <p className="note">
        スクリーニングの実行は CLI から行います（Yahoo への負荷を画面操作で増やさないためです）。
      </p>
    </>
  )
}
