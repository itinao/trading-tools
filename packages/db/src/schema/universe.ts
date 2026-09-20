import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** 東証の上場銘柄一覧（JPX の xlsx）。スクリーニングの母集団と、ウォッチ追加時の銘柄名に使う。Design Doc 0013 §3.1 */
export const universe = sqliteTable('universe', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  segment: text('segment').notNull(),
  segmentRaw: text('segment_raw').notNull(),
  sector33: text('sector33'),
  size: text('size'),
  listedAsOf: text('listed_as_of').notNull(),
  fetchedAt: text('fetched_at').notNull(),
})

export type UniverseRow = typeof universe.$inferSelect
export type Segment = 'prime' | 'standard' | 'growth' | 'other'
