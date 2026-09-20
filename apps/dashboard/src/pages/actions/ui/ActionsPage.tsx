import { Link } from '@tanstack/react-router'
import { ACTION_STATUSES, STATUS_LABEL } from '../../../entities/action/index.ts'
import { InstrumentLink } from '../../../entities/instrument/index.ts'
import { scoreText } from '../../../entities/score/index.ts'
import { ActionCard, groupActions } from '../../../widgets/action-card/index.ts'
import { StatusStrip } from '../../../widgets/status-strip/index.ts'
import type { ActionsPageData } from '../api/get-actions-page.ts'

/** アクション。毎朝の入口。状態の帯 → 未対応 / 対応した / 見送り のタブ → 銘柄ごとのカード（検知 + 助言、まとめて対応）→ スコアの大きな変動 */
export function ActionsPage({ data }: { data: ActionsPageData }) {
  const cards = groupActions(data.actions, data.advice, data.contexts, data.scores)
  return (
    <>
      <header className="page-header">
        <div>
          <h1>アクション</h1>
          <p className="summary">
            保有・ウォッチ銘柄で検知した下落・悪材料・財務悪化と、それに対する AI の助言です。
            <br />
            内容を確認して、対応した / 見送り にしてください。
          </p>
        </div>
      </header>
      <StatusStrip data={data.strip} />
      <div className="tabs">
        {ACTION_STATUSES.map((s) => (
          <Link
            key={s}
            to="/"
            search={{ status: s }}
            activeOptions={{ exact: true }}
            className={s === data.status ? 'active' : ''}
          >
            {STATUS_LABEL[s]} ({data.counts[s]})
          </Link>
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="empty">{STATUS_LABEL[data.status]}のアクションはありません。</p>
      ) : (
        cards.map((card) => <ActionCard key={card.instrumentId} card={card} />)
      )}
      {data.status === 'open' && data.movers.length > 0 && (
        <>
          <h2>スコアの大きな変動</h2>
          <table>
            <thead>
              <tr>
                <th>銘柄</th>
                <th className="num">前回</th>
                <th className="num">今回</th>
                <th className="num">変化</th>
              </tr>
            </thead>
            <tbody>
              {data.movers.map((m) => (
                <tr key={m.instrumentId}>
                  <td>
                    <InstrumentLink id={m.instrumentId} name={m.name} code={m.code} />
                  </td>
                  <td className="num">{scoreText(m.from)}</td>
                  <td className="num">{scoreText(m.to)}</td>
                  <td className={`num ${m.delta < 0 ? 'loss' : 'gain'}`}>
                    {m.delta > 0 ? '+' : ''}
                    {m.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="note">
        アクションは事実の整理、助言は判断材料です。売る / 持つ / 買うの最終判断は人が行います。
      </p>
    </>
  )
}
