import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { KIND_LABEL, pctClass, pctText, price, STATUS_LABEL, yen } from '../format.ts'
import { getInstrumentPage } from '../server/fns.ts'

export const Route = createFileRoute('/instruments/$id')({
  loader: async ({ params }) => {
    const data = await getInstrumentPage({ data: params.id })
    if (!data) throw notFound()
    return data
  },
  notFoundComponent: () => <p>銘柄が見つからない。</p>,
  component: InstrumentPage,
})

function InstrumentPage() {
  const { instrument, position, quotes, signals, actions } = Route.useLoaderData()
  const latest = quotes[0]
  return (
    <>
      <h1>
        {instrument.name} <span className="muted">{instrument.code}</span>
      </h1>
      <p className="muted">
        株価: {price(latest?.price)}（{latest?.asOf ?? '-'}）
        {position && latest && (
          <>
            {' '}
            / 取得単価比{' '}
            <span className={pctClass(pctOf(latest.price, position.averageCost))}>
              {pctText(pctOf(latest.price, position.averageCost))}
            </span>
          </>
        )}
      </p>

      <h2>保有</h2>
      {position ? (
        <table>
          <thead>
            <tr>
              <th>口座</th>
              <th className="num">数量</th>
              <th className="num">取得単価</th>
              <th className="num">評価額（取込時）</th>
              <th className="num">損益（取込時）</th>
            </tr>
          </thead>
          <tbody>
            {position.accounts.map((a) => (
              <tr key={a.account}>
                <td>{a.account}</td>
                <td className="num">{a.quantity.toLocaleString('ja-JP')}</td>
                <td className="num">{price(a.averageCost)}</td>
                <td className="num">{yen(a.marketValue)}</td>
                <td className={`num ${pctClass(a.unrealizedPnl)}`}>{yen(a.unrealizedPnl)}</td>
              </tr>
            ))}
            {position.accounts.length > 1 && (
              <tr>
                <td>合計</td>
                <td className="num">{position.quantity.toLocaleString('ja-JP')}</td>
                <td className="num">{price(Math.round(position.averageCost * 100) / 100)}</td>
                <td className="num">{yen(position.marketValue)}</td>
                <td className={`num ${pctClass(position.unrealizedPnl)}`}>
                  {yen(position.unrealizedPnl)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <p className="muted">最新スナップショットに保有がない。</p>
      )}

      <h2>アクション</h2>
      {actions.length === 0 ? (
        <p className="muted">なし</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>状態</th>
              <th>重大度</th>
              <th>内容</th>
              <th>作成</th>
              <th>対応</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id}>
                <td>{STATUS_LABEL[a.status as keyof typeof STATUS_LABEL] ?? a.status}</td>
                <td className={a.severity ?? ''}>{a.severity ?? a.origin}</td>
                <td>
                  <details>
                    <summary>{a.title}</summary>
                    <pre className="body">{a.body}</pre>
                  </details>
                  {a.note && <div className="muted">メモ: {a.note}</div>}
                </td>
                <td className="muted">{a.createdAt.slice(0, 10)}</td>
                <td className="muted">{a.resolvedAt?.slice(0, 10) ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>シグナル</h2>
      {signals.length === 0 ? (
        <p className="muted">なし</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>種類</th>
              <th>重大度</th>
              <th className="num">値</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id}>
                <td>{s.asOf}</td>
                <td>{KIND_LABEL[s.kind] ?? s.kind}</td>
                <td className={s.severity}>{s.severity}</td>
                <td className="num">{pctText(s.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>株価（直近 30 件）</h2>
      {quotes.length === 0 ? (
        <p className="muted">なし</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th className="num">株価</th>
              <th className="num">前日比</th>
              <th>取得元</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q, i) => {
              const prev = quotes[i + 1]?.price ?? q.previousClose ?? null
              const change = prev ? pctOf(q.price, prev) : null
              return (
                <tr key={q.id}>
                  <td>{q.asOf}</td>
                  <td className="num">{price(q.price)}</td>
                  <td className={`num ${pctClass(change)}`}>{pctText(change)}</td>
                  <td className="muted">{q.source}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p>
        <Link to="/">← アクション一覧</Link>
      </p>
    </>
  )
}

function pctOf(current: number, base: number): number | null {
  if (base <= 0) return null
  return Math.round(((current - base) / base) * 10000) / 100
}
