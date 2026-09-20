import { nowJst } from '@trading/cli'
import { schema, type TradingDatabase } from '@trading/db'
import type { Segment } from '@trading/db/schema'
import { eq, inArray, sql } from 'drizzle-orm'

export interface UniverseInput {
  code: string
  name: string
  segment: Segment
  segmentRaw: string
  sector33: string | null
  size: string | null
  listedAsOf: string
}

/** 上場銘柄一覧を入れ替える（全件 upsert）。Design Doc 0013 §3.1 */
export function upsertUniverse(db: TradingDatabase, rows: UniverseInput[]): number {
  const fetchedAt = nowJst()
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += 500) {
      tx.insert(schema.universe)
        .values(rows.slice(i, i + 500).map((r) => ({ ...r, fetchedAt })))
        .onConflictDoUpdate({
          target: schema.universe.code,
          set: {
            name: sql`excluded.name`,
            segment: sql`excluded.segment`,
            segmentRaw: sql`excluded.segment_raw`,
            sector33: sql`excluded.sector33`,
            size: sql`excluded.size`,
            listedAsOf: sql`excluded.listed_as_of`,
            fetchedAt: sql`excluded.fetched_at`,
          },
        })
        .run()
    }
  })
  return rows.length
}

export function findUniverse(db: TradingDatabase, code: string) {
  return db.select().from(schema.universe).where(eq(schema.universe.code, code)).get()
}

export function universeCount(db: TradingDatabase): number {
  return db.select({ n: sql<number>`count(*)` }).from(schema.universe).get()?.n ?? 0
}

/** 母集団。segments / sectors で絞る */
export function universeRows(
  db: TradingDatabase,
  filter: { segments?: Segment[]; sectors?: string[] } = {},
) {
  const conds = []
  if (filter.segments && filter.segments.length > 0)
    conds.push(inArray(schema.universe.segment, filter.segments))
  if (filter.sectors && filter.sectors.length > 0)
    conds.push(inArray(schema.universe.sector33, filter.sectors))
  const q = db.select().from(schema.universe)
  return (
    conds.length > 0 ? q.where(conds.length === 1 ? conds[0] : sql`${conds[0]} and ${conds[1]}`) : q
  )
    .orderBy(schema.universe.code)
    .all()
}
