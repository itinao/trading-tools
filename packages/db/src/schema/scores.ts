import { primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/** 銘柄ごとの日次スコア（-100..100）と内訳。detect run が計算する。Design Doc 0011 §3.4 */
export const scores = sqliteTable(
  'scores',
  {
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    asOf: text('as_of').notNull(),
    score: real('score').notNull(),
    componentsJson: text('components_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.instrumentId, t.asOf] })],
)

export type Score = typeof scores.$inferSelect
export type NewScore = typeof scores.$inferInsert
