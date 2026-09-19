import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { ActionStatus } from '@trading/domain'
import { KIND_LABEL, pctText, STATUS_LABEL } from '../format.ts'
import { getActionsPage, resolveAction } from '../server/fns.ts'

const STATUSES: ActionStatus[] = ['open', 'done', 'dismissed']

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { status?: ActionStatus } =>
    STATUSES.includes(search.status as ActionStatus)
      ? { status: search.status as ActionStatus }
      : {},
  loaderDeps: ({ search }) => ({ status: search.status ?? 'open' }),
  loader: ({ deps }) => getActionsPage({ data: deps.status }),
  component: ActionsPage,
})

function ActionsPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const resolve = useServerFn(resolveAction)
  const change = async (id: number, status: ActionStatus) => {
    await resolve({ data: { id, status } })
    await router.invalidate()
  }
  const stale = data.latestQuoteDate == null || data.latestQuoteDate < data.today

  return (
    <>
      <h1>アクション</h1>
      {stale && (
        <div className="stale">
          株価の最終取得日: {data.latestQuoteDate ?? 'なし'}（今日は {data.today}）。`pnpm collect
          quotes` と `pnpm detect run` を実行すると更新される。
        </div>
      )}
      <div className="tabs">
        {STATUSES.map((s) => (
          <Link key={s} to="/" search={{ status: s }} className={s === data.status ? 'active' : ''}>
            {STATUS_LABEL[s]} ({data.counts[s]})
          </Link>
        ))}
      </div>
      {data.actions.length === 0 ? (
        <p className="muted">{STATUS_LABEL[data.status]}のアクションはない。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>重大度</th>
              <th>銘柄</th>
              <th>内容</th>
              <th className="num">値</th>
              <th>作成</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.actions.map((a) => (
              <tr key={a.id}>
                <td className={a.severity ?? ''}>{a.severity ?? a.origin}</td>
                <td>
                  <Link to="/instruments/$id" params={{ id: a.instrumentId }}>
                    {a.name}
                  </Link>
                  <div className="muted">{a.code}</div>
                </td>
                <td>
                  <details>
                    <summary>{a.title}</summary>
                    <pre className="body">{a.body}</pre>
                    {a.note && <div className="muted">メモ: {a.note}</div>}
                  </details>
                </td>
                <td className="num">
                  {a.kind ? `${KIND_LABEL[a.kind] ?? a.kind} ${pctText(a.value)}` : '-'}
                </td>
                <td className="muted">{a.createdAt.slice(0, 10)}</td>
                <td>
                  {a.status === 'open' ? (
                    <>
                      <button type="button" onClick={() => change(a.id, 'done')}>
                        対応した
                      </button>{' '}
                      <button type="button" onClick={() => change(a.id, 'dismissed')}>
                        見送り
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => change(a.id, 'open')}>
                      未対応に戻す
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="note">アクションは事実の整理。売る / 持つの最終判断は人が行う。</p>
    </>
  )
}
