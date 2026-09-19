import { Link } from '@tanstack/react-router'
import { pctClass, pctOf, pctText, price } from '../../../shared/lib'
import { YenCell } from '../../../shared/ui'
import { ActionTable } from '../../../widgets/action-table/index.ts'
import { QuoteHistoryTable } from '../../../widgets/quote-history-table/index.ts'
import { SignalTable } from '../../../widgets/signal-table/index.ts'
import type { InstrumentPageData } from '../api/get-instrument-page.ts'

export function InstrumentPage({ data }: { data: InstrumentPageData }) {
  const { instrument, position, quotes, signals, actions } = data
  const latest = quotes[0]
  const costChange = position && latest ? pctOf(latest.price, position.averageCost) : null
  return (
    <>
      <h1>
        {instrument.name} <span className="muted">{instrument.code}</span>
      </h1>
      <p className="muted">
        株価: {price(latest?.price)}（{latest?.asOf ?? '-'}）
        {costChange != null && (
          <>
            {' '}
            / 取得単価比 <span className={pctClass(costChange)}>{pctText(costChange)}</span>
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
                <YenCell value={a.marketValue} />
                <YenCell value={a.unrealizedPnl} signed />
              </tr>
            ))}
            {position.accounts.length > 1 && (
              <tr>
                <td>合計</td>
                <td className="num">{position.quantity.toLocaleString('ja-JP')}</td>
                <td className="num">{price(Math.round(position.averageCost * 100) / 100)}</td>
                <YenCell value={position.marketValue} />
                <YenCell value={position.unrealizedPnl} signed />
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <p className="muted">最新スナップショットに保有がない。</p>
      )}

      <h2>アクション</h2>
      <ActionTable actions={actions} showInstrument={false} showStatus resolvable={false} />

      <h2>シグナル</h2>
      <SignalTable signals={signals} />

      <h2>株価（直近 30 件）</h2>
      <QuoteHistoryTable quotes={quotes} />
      <p>
        <Link to="/">← アクション一覧</Link>
      </p>
    </>
  )
}
