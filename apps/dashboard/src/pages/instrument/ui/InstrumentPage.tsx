import { Link } from '@tanstack/react-router'
import { dayChangePct } from '../../../entities/quote/index.ts'
import { scoreClass, scoreText } from '../../../entities/score/index.ts'
import { dateOnly, pctClass, pctOf, pctText, price, yen } from '../../../shared/lib'
import { Icon, Sparkline, YenCell } from '../../../shared/ui'
import { ActionCard, groupActions } from '../../../widgets/action-card/index.ts'
import { DisclosureList } from '../../../widgets/disclosure-list/index.ts'
import { FinancialsTable } from '../../../widgets/financials-table/index.ts'
import { NewsList } from '../../../widgets/news-list/index.ts'
import { QuoteHistoryTable } from '../../../widgets/quote-history-table/index.ts'
import { Timeline } from '../../../widgets/timeline/index.ts'
import type { InstrumentPageData } from '../api/get-instrument-page.ts'

export type InstrumentTab = 'overview' | 'timeline' | 'news' | 'financials' | 'quotes'
const TABS: { key: InstrumentTab; label: string; icon: string }[] = [
  { key: 'overview', label: '概要', icon: 'dashboard' },
  { key: 'timeline', label: 'タイムライン', icon: 'timeline' },
  { key: 'news', label: 'ニュース・開示', icon: 'newspaper' },
  { key: 'financials', label: '財務・指標', icon: 'account_balance' },
  { key: 'quotes', label: '株価', icon: 'show_chart' },
]

/** 銘柄詳細。ヘッダ帯（株価・スコア・折れ線）で「今どうか」、タブで 概要 / タイムライン / ニュース・開示 / 財務・指標 / 株価 */
export function InstrumentPage({ data, tab }: { data: InstrumentPageData; tab: InstrumentTab }) {
  const {
    instrument,
    position,
    quotes,
    actions,
    advice,
    news,
    disclosures,
    score,
    watch,
    timeline: events,
    sparkline,
    financials,
    fundamentals,
    context,
  } = data
  const latest = quotes[0]
  const dayChange = latest ? dayChangePct(latest, quotes[1]) : null
  const costChange = position && latest ? pctOf(latest.price, position.averageCost) : null
  const contexts = context ? { [instrument.id]: context } : {}
  const cards = groupActions(actions, advice, contexts, { [instrument.id]: score?.score ?? null })
  const openCards = cards
    .map((c) => ({ ...c, actions: c.actions.filter((a) => a.status === 'open') }))
    .filter((c) => c.actions.length > 0)
  return (
    <>
      <header className="page-header instrument-header">
        <div>
          <h1>
            {instrument.name} <span className="muted">{instrument.code}</span>{' '}
            {context && (
              <span className={`badge badge-${context === 'watch' ? 'primary' : 'neutral'}`}>
                {context === 'watch' ? 'ウォッチ' : '保有'}
              </span>
            )}
          </h1>
          <p className="summary">
            株価 {price(latest?.price)}（{latest?.asOf ?? '-'}） 前日比{' '}
            <span className={pctClass(dayChange)}>{pctText(dayChange)}</span>
            {costChange != null && (
              <>
                {' '}
                取得単価比 <span className={pctClass(costChange)}>{pctText(costChange)}</span>
              </>
            )}
            {watch &&
              ` / ウォッチ ${dateOnly(watch.addedAt)} に追加${watch.note ? `（${watch.note}）` : ''}`}
          </p>
        </div>
        <div className="instrument-score">
          <div className={`score-value ${scoreClass(score?.score)}`}>{scoreText(score?.score)}</div>
          <div className="muted">
            {score
              ? `判定 ${scoreText(score.components.assessment)} / 株価 ${scoreText(score.components.price)} / 財務 ${scoreText(score.components.financials)}`
              : 'スコアなし'}
          </div>
        </div>
      </header>
      <Sparkline points={sparkline.price} format={(v) => price(v)} />

      <div className="tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to="/instruments/$id"
            params={{ id: instrument.id }}
            search={t.key === 'overview' ? {} : { tab: t.key }}
            activeOptions={{ exact: true }}
            className={t.key === tab ? 'active' : ''}
          >
            <Icon name={t.icon} className="icon-sm" /> {t.label}
          </Link>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <h2>未対応のアクション</h2>
          {openCards.length === 0 ? (
            <p className="empty">未対応のアクションはない</p>
          ) : (
            openCards.map((c) => <ActionCard key={c.instrumentId} card={c} />)
          )}
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
            <p className="empty">保有していません{watch ? '（ウォッチ中）' : ''}。</p>
          )}
          <p className="muted">
            評価額 {yen(position?.marketValue)}{' '}
            円（取込時）。最新の評価は銘柄一覧を参照してください。
          </p>
        </>
      )}
      {tab === 'timeline' && (
        <>
          <h2>タイムライン（直近 90 日）</h2>
          <Sparkline points={sparkline.score} height={32} format={(v) => v.toFixed(0)} />
          <Timeline events={events} />
        </>
      )}
      {tab === 'news' && (
        <>
          <h2>適時開示（直近 20 件）</h2>
          <DisclosureList items={disclosures} />
          <h2>ニュース（直近 20 件）</h2>
          <NewsList items={news} />
        </>
      )}
      {tab === 'financials' && (
        <>
          <h2>財務・指標</h2>
          <FinancialsTable rows={financials} fundamentals={fundamentals} />
        </>
      )}
      {tab === 'quotes' && (
        <>
          <h2>株価（直近 30 件）</h2>
          <QuoteHistoryTable quotes={quotes} />
        </>
      )}
      <h2>すべてのアクション</h2>
      {cards.length === 0 ? (
        <p className="empty">なし</p>
      ) : (
        cards.map((c) => <ActionCard key={`all-${c.instrumentId}`} card={c} resolvable={false} />)
      )}
    </>
  )
}
