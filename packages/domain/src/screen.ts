import { nowJst } from '@trading/cli'
import { schema, type TradingDatabase } from '@trading/db'
import { desc, eq } from 'drizzle-orm'

export interface ScreenResultInput {
  code: string
  name: string
  segment: string
  sector33: string | null
  price: number | null
  per: number | null
  forwardPer: number | null
  pbr: number | null
  dividendYield: number | null
  marketCap: number | null
  growthYears: number | null
}

export function saveScreenRun(
  db: TradingDatabase,
  input: {
    preset: string | null
    criteria: unknown
    universeSize: number
    results: ScreenResultInput[]
  },
): number {
  return db.transaction((tx) => {
    const run = tx
      .insert(schema.screenRuns)
      .values({
        executedAt: nowJst(),
        preset: input.preset,
        criteriaJson: JSON.stringify(input.criteria),
        universeSize: input.universeSize,
        matched: input.results.length,
      })
      .returning({ id: schema.screenRuns.id })
      .get()
    const runId = run?.id as number
    if (input.results.length > 0) {
      tx.insert(schema.screenResults)
        .values(input.results.map((r, i) => ({ runId, ...r, rank: i + 1 })))
        .run()
    }
    return runId
  })
}

export function listScreenRuns(db: TradingDatabase, limit = 20) {
  return db.select().from(schema.screenRuns).orderBy(desc(schema.screenRuns.id)).limit(limit).all()
}

export function getScreenRun(db: TradingDatabase, id: number) {
  const run = db.select().from(schema.screenRuns).where(eq(schema.screenRuns.id, id)).get()
  if (!run) return undefined
  const results = db
    .select()
    .from(schema.screenResults)
    .where(eq(schema.screenResults.runId, id))
    .orderBy(schema.screenResults.rank)
    .all()
  return { ...run, criteria: JSON.parse(run.criteriaJson) as unknown, results }
}
