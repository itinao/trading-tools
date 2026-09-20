import { createServerFn } from '@tanstack/react-start'
import {
  ACTION_STATUSES,
  type ActionStatus,
  isActionStatus,
} from '../../../entities/action/index.ts'

export const getActionsPage = createServerFn({ method: 'GET' })
  .validator((status: ActionStatus) => (isActionStatus(status) ? status : 'open'))
  .handler(async ({ data: status }) => {
    const { db, lastCollectRun } = await import('../../../shared/api')
    const {
      adviceForActions,
      dashboardStatus,
      latestScores,
      listActions,
      monitoredInstruments,
      scoreHistory,
    } = await import('@trading/domain')
    const { todayJst } = await import('@trading/cli')
    const d = db()
    const actions = listActions(d, { status })
    const st = dashboardStatus(d)
    const contexts = Object.fromEntries(
      monitoredInstruments(d).map((m) => [
        m.instrumentId,
        m.position ? ('holding' as const) : ('watch' as const),
      ]),
    )
    const scores = latestScores(d)
    // スコアの大きな変動（前回から ±10 以上。Design Doc 0015 §3.3、閾値は U1）
    const movers = [...scores.entries()]
      .map(([id, s]) => {
        const prev = scoreHistory(d, id, 2)[1]
        return prev
          ? {
              instrumentId: id,
              from: prev.score,
              to: s.score,
              delta: Math.round((s.score - prev.score) * 10) / 10,
            }
          : null
      })
      .filter((m): m is NonNullable<typeof m> => m !== null && Math.abs(m.delta) >= 10)
    const names = new Map(
      monitoredInstruments(d).map((m) => [m.instrumentId, { code: m.code, name: m.name }]),
    )
    return {
      status,
      today: todayJst(),
      strip: {
        today: todayJst(),
        latestQuoteDate: st.latestQuoteDate,
        pendingAssessments: st.pendingAssessments,
        openActions: st.openActions,
        lastCollect: lastCollectRun(),
      },
      counts: Object.fromEntries(
        ACTION_STATUSES.map((s) => [s, listActions(d, { status: s }).length]),
      ) as Record<ActionStatus, number>,
      actions,
      advice: Object.fromEntries([...adviceForActions(d, actions)].map(([id, adv]) => [id, adv])),
      contexts,
      scores: Object.fromEntries([...scores.entries()].map(([id, s]) => [id, s.score])),
      movers: movers.map((m) => ({
        ...m,
        code: names.get(m.instrumentId)?.code ?? '',
        name: names.get(m.instrumentId)?.name ?? m.instrumentId,
      })),
    }
  })

export type ActionsPageData = Awaited<ReturnType<typeof getActionsPage>>
