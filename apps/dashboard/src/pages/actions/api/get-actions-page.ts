import { createServerFn } from '@tanstack/react-start'
import {
  ACTION_STATUSES,
  type ActionStatus,
  isActionStatus,
} from '../../../entities/action/index.ts'

export const getActionsPage = createServerFn({ method: 'GET' })
  .validator((status: ActionStatus) => (isActionStatus(status) ? status : 'open'))
  .handler(async ({ data: status }) => {
    const { db } = await import('../../../shared/api')
    const { adviceForActions, latestQuoteDate, listActions } = await import('@trading/domain')
    const { todayJst } = await import('@trading/cli')
    const d = db()
    const actions = listActions(d, { status })
    return {
      status,
      today: todayJst(),
      latestQuoteDate: latestQuoteDate(d) ?? null,
      counts: Object.fromEntries(
        ACTION_STATUSES.map((s) => [s, listActions(d, { status: s }).length]),
      ) as Record<ActionStatus, number>,
      actions,
      advice: Object.fromEntries([...adviceForActions(d, actions)].map(([id, adv]) => [id, adv])),
    }
  })

export type ActionsPageData = Awaited<ReturnType<typeof getActionsPage>>
