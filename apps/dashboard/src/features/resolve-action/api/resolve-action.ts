import { createServerFn } from '@tanstack/react-start'
import { type ActionStatus, isActionStatus } from '../../../entities/action/index.ts'

/** アクションの状態変更。CLI の `actions resolve` と同じ setActionStatus を使う（Design Doc 0005 §3.4） */
export const resolveAction = createServerFn({ method: 'POST' })
  .validator((input: { id: number; status: ActionStatus }) => {
    if (!Number.isInteger(input.id) || !isActionStatus(input.status)) throw new Error('bad input')
    return input
  })
  .handler(async ({ data }) => {
    const { db } = await import('../../../shared/api')
    const { setActionStatus } = await import('@trading/domain')
    return setActionStatus(db(), data.id, data.status) ?? null
  })
