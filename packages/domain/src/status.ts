import { schema, type TradingDatabase } from '@trading/db'
import { and, eq, sql } from 'drizzle-orm'
import { pendingSubjects } from './assessments.ts'
import { monitoredInstruments } from './monitored.ts'
import { latestQuoteDate } from './quotes.ts'

/** サイドバーと状態の帯に出す数値（Design Doc 0015 §3.1 / §3.3）。軽いクエリだけ */
export interface DashboardStatus {
  latestQuoteDate: string | null
  openActions: { holding: number; watch: number; total: number }
  pendingAssessments: number
  monitored: { holding: number; watch: number }
}

export function dashboardStatus(db: TradingDatabase): DashboardStatus {
  const monitored = monitoredInstruments(db)
  const watchIds = new Set(monitored.filter((m) => m.position === null).map((m) => m.instrumentId))
  const open = db
    .select({ instrumentId: schema.actions.instrumentId, n: sql<number>`count(*)` })
    .from(schema.actions)
    .where(and(eq(schema.actions.status, 'open'), eq(schema.actions.origin, 'rule')))
    .groupBy(schema.actions.instrumentId)
    .all()
  let holding = 0
  let watch = 0
  for (const r of open) {
    if (watchIds.has(r.instrumentId)) watch += r.n
    else holding += r.n
  }
  return {
    latestQuoteDate: latestQuoteDate(db) ?? null,
    openActions: { holding, watch, total: holding + watch },
    pendingAssessments:
      pendingSubjects(db, { limit: 1 }).remaining + pendingSubjects(db, { limit: 1 }).items.length,
    monitored: {
      holding: monitored.filter((m) => m.position !== null).length,
      watch: watchIds.size,
    },
  }
}
