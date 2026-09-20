import { createServerFn } from '@tanstack/react-start'

export const getInstrumentPage = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { db } = await import('../../../shared/api')
    const { schema } = await import('@trading/db')
    const { desc, eq } = await import('drizzle-orm')
    const {
      effectiveAssessments,
      latestScores,
      listActions,
      positions,
      quoteHistory,
      recentDisclosures,
      recentNews,
    } = await import('@trading/domain')
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
    const assessments = effectiveAssessments(d, { instrumentId: id })
    const byKey = new Map(assessments.map((a) => [`${a.subjectType}:${a.subjectId}`, a]))
    const view = (a: (typeof assessments)[number]) => ({
      id: a.id,
      relevance: a.relevance,
      sentiment: a.sentiment,
      impact: a.impact,
      direction: a.direction,
      summary: a.summary,
      rationale: a.rationale,
      author: a.author,
    })
    return {
      instrument,
      position,
      quotes,
      signals,
      actions: listActions(d, { instrumentId: id }),
      news: recentNews(d, id, 20).map((n) => ({
        ...n,
        assessment: byKey.has(`news:${n.id}`)
          ? view(byKey.get(`news:${n.id}`) as (typeof assessments)[number])
          : null,
      })),
      disclosures: recentDisclosures(d, id, 20).map((x) => ({
        ...x,
        assessment: byKey.has(`disclosure:${x.id}`)
          ? view(byKey.get(`disclosure:${x.id}`) as (typeof assessments)[number])
          : null,
      })),
      score: latestScores(d).get(id) ?? null,
    }
  })

export type InstrumentPageData = NonNullable<Awaited<ReturnType<typeof getInstrumentPage>>>
