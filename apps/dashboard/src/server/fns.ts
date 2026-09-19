import { createServerFn } from '@tanstack/react-start'
import type { ActionStatus } from '@trading/domain'

/**
 * サーバー関数。DB を読むモジュールは handler 内で動的 import し、クライアントバンドルに入れない。
 * 書き込みはアクションの状態変更のみ（Design Doc 0005 §3.5）。
 */

const STATUSES: readonly ActionStatus[] = ['open', 'done', 'dismissed']

export const getActionsPage = createServerFn({ method: 'GET' })
  .inputValidator((status: ActionStatus) => (STATUSES.includes(status) ? status : 'open'))
  .handler(async ({ data: status }) => {
    const { db } = await import('./db.ts')
    const { latestQuoteDate, listActions } = await import('@trading/domain')
    const { todayJst } = await import('@trading/cli')
    const d = db()
    return {
      status,
      today: todayJst(),
      latestQuoteDate: latestQuoteDate(d) ?? null,
      counts: Object.fromEntries(
        STATUSES.map((s) => [s, listActions(d, { status: s }).length]),
      ) as Record<ActionStatus, number>,
      actions: listActions(d, { status }),
    }
  })

export const resolveAction = createServerFn({ method: 'POST' })
  .inputValidator((input: { id: number; status: ActionStatus }) => {
    if (!Number.isInteger(input.id) || !STATUSES.includes(input.status))
      throw new Error('bad input')
    return input
  })
  .handler(async ({ data }) => {
    const { db } = await import('./db.ts')
    const { setActionStatus } = await import('@trading/domain')
    return setActionStatus(db(), data.id, data.status) ?? null
  })

export const getHoldingsPage = createServerFn({ method: 'GET' }).handler(async () => {
  const { db } = await import('./db.ts')
  const { latestQuoteDate, latestQuotes, latestSnapshot, positions, quoteHistory } = await import(
    '@trading/domain'
  )
  const d = db()
  const quotes = latestQuotes(d)
  const rows = positions(d).map((p) => {
    const q = quotes.get(p.instrumentId)
    const prev = q
      ? (quoteHistory(d, p.instrumentId, { upTo: q.asOf, limit: 2 })[1]?.price ??
        q.previousClose ??
        null)
      : null
    const price = q?.price ?? null
    return {
      instrumentId: p.instrumentId,
      code: p.code,
      name: p.name,
      quantity: p.quantity,
      averageCost: p.averageCost,
      price,
      priceAsOf: q?.asOf ?? null,
      dayChangePct: price != null && prev ? pct(price, prev) : null,
      costChangePct: price != null && p.averageCost > 0 ? pct(price, p.averageCost) : null,
      marketValue: price != null ? Math.round(price * p.quantity) : p.marketValue,
      unrealizedPnl:
        price != null ? Math.round((price - p.averageCost) * p.quantity) : p.unrealizedPnl,
    }
  })
  return {
    snapshotAsOf: latestSnapshot(d)?.asOf ?? null,
    latestQuoteDate: latestQuoteDate(d) ?? null,
    rows,
  }
})

export const getInstrumentPage = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { db } = await import('./db.ts')
    const { schema } = await import('@trading/db')
    const { eq, desc } = await import('drizzle-orm')
    const { listActions, positions, quoteHistory } = await import('@trading/domain')
    const d = db()
    const instrument = d
      .select()
      .from(schema.instruments)
      .where(eq(schema.instruments.id, id))
      .get()
    if (!instrument) return null
    const position = positions(d).find((p) => p.instrumentId === id) ?? null
    const quotes = quoteHistory(d, id, { limit: 30 })
    const signals = d
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.instrumentId, id))
      .orderBy(desc(schema.signals.asOf), desc(schema.signals.id))
      .limit(50)
      .all()
    return { instrument, position, quotes, signals, actions: listActions(d, { instrumentId: id }) }
  })

function pct(current: number, base: number): number {
  return Math.round(((current - base) / base) * 10000) / 100
}
