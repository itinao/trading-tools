import {
  ActionBody,
  type ActionView,
  isOffenseKind,
  kindLabel,
  SeverityBadge,
} from '../../../entities/action/index.ts'
import { AdvicePanel, type AdviceView } from '../../../entities/advice/index.ts'
import { InstrumentLink } from '../../../entities/instrument/index.ts'
import { scoreClass, scoreText } from '../../../entities/score/index.ts'
import { ResolveButtons, ResolveGroupButtons } from '../../../features/resolve-action/index.ts'
import { dateOnly, pctText } from '../../../shared/lib'

export interface ActionCardData {
  instrumentId: string
  code: string
  name: string
  context: 'holding' | 'watch'
  score: number | null
  actions: ActionView[]
  advice: Record<number, AdviceView | null>
}

/** 銘柄ごとのカード。その銘柄のアクションと助言をまとめ、一括で対応できる（Design Doc 0015 §3.3） */
export function ActionCard({
  card,
  resolvable = true,
}: {
  card: ActionCardData
  resolvable?: boolean
}) {
  const status = card.actions[0]?.status ?? 'open'
  const sameStatus = card.actions.every((a) => a.status === status)
  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">
          <InstrumentLink id={card.instrumentId} name={card.name} code={card.code} />
        </div>
        <div className="card-meta">
          <span className={`badge badge-${card.context === 'watch' ? 'primary' : 'neutral'}`}>
            {card.context === 'watch' ? 'ウォッチ' : '保有'}
          </span>
          <span className={`score-inline ${scoreClass(card.score)}`}>
            スコア {scoreText(card.score)}
          </span>
        </div>
        {resolvable && sameStatus && card.actions.length > 1 && (
          <div className="card-actions">
            <ResolveGroupButtons ids={card.actions.map((a) => a.id)} status={status} />
          </div>
        )}
      </header>
      <ul className="card-list">
        {card.actions.map((a) => (
          <li key={a.id} className="card-item">
            <div className="card-item-head">
              <SeverityBadge
                severity={a.severity}
                fallback={a.origin}
                offense={isOffenseKind(a.kind)}
              />
              <span className="card-item-title">
                <ActionBody title={a.title} body={a.body} note={a.note} />
              </span>
              <span className="muted nowrap">
                {a.kind ? `${kindLabel(a.kind)} ${pctText(a.value)}` : ''} / {dateOnly(a.createdAt)}
              </span>
              {resolvable && (
                <span className="card-item-ops">
                  <ResolveButtons id={a.id} status={a.status} />
                </span>
              )}
            </div>
            <div className="card-item-advice">
              <AdvicePanel advice={card.advice[a.id] ?? null} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** アクションを銘柄ごとにまとめる。順序は最も重い重大度 → 新しい順 */
export function groupActions(
  actions: ActionView[],
  advice: Record<number, AdviceView | null>,
  contexts: Record<string, 'holding' | 'watch'>,
  scores: Record<string, number | null>,
): ActionCardData[] {
  const byInstrument = new Map<string, ActionCardData>()
  for (const a of actions) {
    let card = byInstrument.get(a.instrumentId)
    if (!card) {
      card = {
        instrumentId: a.instrumentId,
        code: a.code,
        name: a.name,
        context: contexts[a.instrumentId] ?? 'holding',
        score: scores[a.instrumentId] ?? null,
        actions: [],
        advice,
      }
      byInstrument.set(a.instrumentId, card)
    }
    card.actions.push(a)
  }
  return [...byInstrument.values()]
}
