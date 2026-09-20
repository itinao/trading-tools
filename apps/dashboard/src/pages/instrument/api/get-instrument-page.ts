import { createServerFn } from '@tanstack/react-start'

export const getInstrumentPage = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { db } = await import('../../../shared/api')
    const { schema } = await import('@trading/db')
    const { desc, eq } = await import('drizzle-orm')
    const { listActions, positions, quoteHistory, recentDisclosures, recentNews } = await import(
      '@trading/domain'
    )
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
    return {
      instrument,
      position,
      quotes,
      signals,
      actions: listActions(d, { instrumentId: id }),
      news: recentNews(d, id, 20),
      disclosures: recentDisclosures(d, id, 20),
    }
  })

export type InstrumentPageData = NonNullable<Awaited<ReturnType<typeof getInstrumentPage>>>
