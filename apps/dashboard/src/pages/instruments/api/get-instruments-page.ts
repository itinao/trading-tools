import { createServerFn } from '@tanstack/react-start'
import { valuation } from '../../../entities/holding/index.ts'
import { dayChangePct } from '../../../entities/quote/index.ts'
import type { HoldingRow } from '../../../widgets/holdings-table/index.ts'
import type { WatchRow } from '../../../widgets/watch-table/index.ts'

/** 監視している銘柄（保有 / ウォッチ）。Design Doc 0015 §3.4 */
export const getInstrumentsPage = createServerFn({ method: 'GET' }).handler(async () => {
  const { db } = await import('../../../shared/api')
  const {
    latestQuoteDate,
    latestQuotes,
    latestScores,
    latestSnapshot,
    listActions,
    listWatches,
    positions,
    quoteHistory,
  } = await import('@trading/domain')
  const d = db()
  const quotes = latestQuotes(d)
  const scores = latestScores(d)
  const pct = (a: number, b: number | null) =>
    b && b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : null
  const holdings: HoldingRow[] = positions(d).map((p) => {
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
  const open = listActions(d, { status: 'open' })
  const watches: WatchRow[] = listWatches(d).map((w) => {
    const q = quotes.get(w.instrumentId)
    const hist = q ? quoteHistory(d, w.instrumentId, { upTo: q.asOf, limit: 200 }) : []
    const high60 = hist.length > 0 ? Math.max(...hist.slice(0, 60).map((x) => x.price)) : null
    const ma200 = hist.length >= 200 ? hist.reduce((s, x) => s + x.price, 0) / 200 : null
    return {
      instrumentId: w.instrumentId,
      code: w.code,
      name: w.name,
      addedAt: w.watch?.addedAt ?? null,
      note: w.watch?.note ?? null,
      price: q?.price ?? null,
      priceAsOf: q?.asOf ?? null,
      drawdownFromHigh60: q ? pct(q.price, high60) : null,
      vsMa200: q ? pct(q.price, ma200) : null,
      score: scores.get(w.instrumentId)?.score ?? null,
      openActions: open.filter((a) => a.instrumentId === w.instrumentId).length,
    }
  })
  return {
    snapshotAsOf: latestSnapshot(d)?.asOf ?? null,
    latestQuoteDate: latestQuoteDate(d) ?? null,
    holdings,
    watches,
  }
})

export type InstrumentsPageData = Awaited<ReturnType<typeof getInstrumentsPage>>
