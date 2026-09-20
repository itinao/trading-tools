import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/** ウォッチ銘柄（まだ持っていないが監視する）。Design Doc 0013 §3.1 */
export const watches = sqliteTable('watches', {
  instrumentId: text('instrument_id')
    .primaryKey()
    .references(() => instruments.id),
  addedAt: text('added_at').notNull(),
  note: text('note'),
  source: text('source').notNull(),
  screenRunId: integer('screen_run_id'),
})

export type Watch = typeof watches.$inferSelect
