import { createServerFn } from '@tanstack/react-start'

export const getHistoryPage = createServerFn({ method: 'GET' })
  .validator((input: { since?: string }) => input)
  .handler(async ({ data }) => {
    const { db } = await import('../../../shared/api')
    const { history } = await import('@trading/domain')
    const d = db()
    const h = history(d, data.since ? { since: data.since } : {})
    return { since: data.since ?? null, rows: h.rows, summary: h.summary }
  })

export type HistoryPageData = Awaited<ReturnType<typeof getHistoryPage>>
