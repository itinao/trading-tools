import { nowJst } from '@trading/cli'
import { schema, type TradingDatabase } from '@trading/db'
import { desc, eq, sql } from 'drizzle-orm'

export interface ScoreComponents {
  assessment: number
  price: number
  financials: number
  notes: string[]
}

export function upsertScore(
  db: TradingDatabase,
  instrumentId: string,
  asOf: string,
  score: number,
  components: ScoreComponents,
): void {
  db.insert(schema.scores)
    .values({
      instrumentId,
      asOf,
      score,
      componentsJson: JSON.stringify(components),
      createdAt: nowJst(),
    })
    .onConflictDoUpdate({
      target: [schema.scores.instrumentId, schema.scores.asOf],
      set: {
        score: sql`excluded.score`,
        componentsJson: sql`excluded.components_json`,
        createdAt: sql`excluded.created_at`,
      },
    })
    .run()
}

/** 各銘柄の最新スコア */
export function latestScores(
  db: TradingDatabase,
): Map<string, { asOf: string; score: number; components: ScoreComponents }> {
  const rows = db.select().from(schema.scores).orderBy(desc(schema.scores.asOf)).all()
  const out = new Map<string, { asOf: string; score: number; components: ScoreComponents }>()
  for (const r of rows) {
    if (!out.has(r.instrumentId))
      out.set(r.instrumentId, {
        asOf: r.asOf,
        score: r.score,
        components: JSON.parse(r.componentsJson) as ScoreComponents,
      })
  }
  return out
}

export function scoreHistory(db: TradingDatabase, instrumentId: string, limit = 60) {
  return db
    .select()
    .from(schema.scores)
    .where(eq(schema.scores.instrumentId, instrumentId))
    .orderBy(desc(schema.scores.asOf))
    .limit(limit)
    .all()
    .map((r) => ({
      asOf: r.asOf,
      score: r.score,
      components: JSON.parse(r.componentsJson) as ScoreComponents,
    }))
}
