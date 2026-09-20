import { createServerFn } from '@tanstack/react-start'

/** 複数のアクションをまとめて同じ状態にする（銘柄カードの一括操作。Design Doc 0015 §3.3） */
export const resolveActions = createServerFn({ method: 'POST' })
  .validator((input: { ids: number[]; status: 'open' | 'done' | 'dismissed' }) => {
    if (
      !Array.isArray(input.ids) ||
      input.ids.some((id) => !Number.isInteger(id)) ||
      !['open', 'done', 'dismissed'].includes(input.status)
    )
      throw new Error('bad input')
    return input
  })
  .handler(async ({ data }) => {
    const { db } = await import('../../../shared/api')
    const { setActionStatus } = await import('@trading/domain')
    const d = db()
    return data.ids.map((id) => setActionStatus(d, id, data.status) ?? null)
  })
