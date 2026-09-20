import { createServerFn } from '@tanstack/react-start'

export const getInstrumentPage = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { db } = await import('../../../shared/api')
    const { schema } = await import('@trading/db')
    const { desc, eq } = await import('drizzle-orm')
    const {
      adviceForActions,
      effectiveAssessments,
      financialHistory,
      latestFundamentals,
      latestScores,
      listActions,
      monitoredInstruments,
      quoteHistory,
      recentDisclosures,
      recentNews,
      sparklineData,
      timeline,
    } = await import('@trading/domain')
    const d = db()
    const instrument = d
      .select()
      .from(schema.instruments)
      .where(eq(schema.instruments.id, id))
      .get()
    if (!instrument) return null
    const monitored = monitoredInstruments(d).find((m) => m.instrumentId === id) ?? null
    const position = monitored?.position ?? null
    const quotes = quoteHistory(d, id, { limit: 30 })
    const signals = d
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.instrumentId, id))
      .orderBy(desc(schema.signals.asOf), desc(schema.signals.id))
      .limit(50)
      .all()
    const actions = listActions(d, { instrumentId: id })
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
      actions,
      advice: Object.fromEntries([...adviceForActions(d, actions)].map(([k, v]) => [k, v])),
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
      watch: monitored?.watch ?? null,
      timeline: timeline(d, id, { days: 90 }).events,
      financials: financialHistory(d, id, 'annual'),
      fundamentals: latestFundamentals(d, id) ?? null,
      context: monitored ? (monitored.position ? ('holding' as const) : ('watch' as const)) : null,
      sparkline: sparklineData(d, id),
    }
  })

export type InstrumentPageData = NonNullable<Awaited<ReturnType<typeof getInstrumentPage>>>
