import { createFileRoute, Link } from '@tanstack/react-router'
import { pctClass, pctText, price, yen } from '../format.ts'
import { getHoldingsPage } from '../server/fns.ts'

export const Route = createFileRoute('/holdings')({
  loader: () => getHoldingsPage(),
  component: HoldingsPage,
})

function HoldingsPage() {
  const data = Route.useLoaderData()
  const total = data.rows.reduce((s, r) => s + r.marketValue, 0)
  const pnl = data.rows.reduce((s, r) => s + r.unrealizedPnl, 0)
  return (
    <>
      <h1>保有</h1>
      <p className="muted">
        スナップショット: {data.snapshotAsOf?.slice(0, 10) ?? 'なし'} / 株価:{' '}
        {data.latestQuoteDate ?? 'なし'} / 評価額 {yen(total)} 円 / 損益{' '}
        <span className={pctClass(pnl)}>{yen(pnl)} 円</span>
      </p>
      {data.rows.length === 0 ? (
        <p className="muted">保有がない。`pnpm import-holdings run` で取り込む。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>銘柄</th>
              <th className="num">数量</th>
              <th className="num">取得単価</th>
              <th className="num">株価</th>
              <th className="num">前日比</th>
              <th className="num">取得単価比</th>
              <th className="num">評価額</th>
              <th className="num">損益</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.instrumentId}>
                <td>
                  <Link to="/instruments/$id" params={{ id: r.instrumentId }}>
                    {r.name}
                  </Link>
                  <div className="muted">{r.code}</div>
                </td>
                <td className="num">{r.quantity.toLocaleString('ja-JP')}</td>
                <td className="num">{price(Math.round(r.averageCost * 100) / 100)}</td>
                <td className="num">
                  {price(r.price)}
                  {r.priceAsOf && r.priceAsOf !== data.latestQuoteDate && (
                    <div className="muted">{r.priceAsOf}</div>
                  )}
                </td>
                <td className={`num ${pctClass(r.dayChangePct)}`}>{pctText(r.dayChangePct)}</td>
                <td className={`num ${pctClass(r.costChangePct)}`}>{pctText(r.costChangePct)}</td>
                <td className="num">{yen(r.marketValue)}</td>
                <td className={`num ${pctClass(r.unrealizedPnl)}`}>{yen(r.unrealizedPnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
