import { createServerFn } from '@tanstack/react-start'
import { valuation } from '../../../entities/holding/index.ts'
import { dayChangePct } from '../../../entities/quote/index.ts'
import type { HoldingRow } from '../../../widgets/holdings-table/index.ts'

export const getHoldingsPage = createServerFn({ method: 'GET' }).handler(async () => {
  const { db } = await import('../../../shared/api')
  const { latestQuoteDate, latestQuotes, latestScores, latestSnapshot, positions, quoteHistory } =
    await import('@trading/domain')
  const d = db()
  const quotes = latestQuotes(d)
  const scores = latestScores(d)
  const rows: HoldingRow[] = positions(d).map((p) => {
    const q = quotes.get(p.instrumentId)
    const previous = q ? quoteHistory(d, p.instrumentId, { upTo: q.asOf, limit: 2 })[1] : undefined
    const price = q?.price ?? null
    return {
      instrumentId: p.instrumentId,
      code: p.code,
      name: p.name,
      quantity: p.quantity,
      averageCost: p.averageCost,
      price,
      priceAsOf: q?.asOf ?? null,
      dayChangePct: q ? dayChangePct(q, previous) : null,
      score: scores.get(p.instrumentId)?.score ?? null,
      ...valuation(p, price),
    }
  })
  return {
    snapshotAsOf: latestSnapshot(d)?.asOf ?? null,
    latestQuoteDate: latestQuoteDate(d) ?? null,
    rows,
  }
})

export type HoldingsPageData = Awaited<ReturnType<typeof getHoldingsPage>>
