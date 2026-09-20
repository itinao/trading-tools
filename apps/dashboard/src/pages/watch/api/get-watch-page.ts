import { createServerFn } from '@tanstack/react-start'
import type { WatchRow } from '../../../widgets/watch-table/index.ts'

export const getWatchPage = createServerFn({ method: 'GET' }).handler(async () => {
  const { db } = await import('../../../shared/api')
  const { latestQuoteDate, latestQuotes, latestScores, listActions, listWatches, quoteHistory } =
    await import('@trading/domain')
  const d = db()
  const quotes = latestQuotes(d)
  const scores = latestScores(d)
  const open = listActions(d, { status: 'open' })
  const pct = (a: number, b: number | null) =>
    b && b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : null
  const rows: WatchRow[] = listWatches(d).map((w) => {
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
  return { latestQuoteDate: latestQuoteDate(d) ?? null, rows }
})

export type WatchPageData = Awaited<ReturnType<typeof getWatchPage>>
