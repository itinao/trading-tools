import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** スクリーニングの実行。条件を凍結して保存する。Design Doc 0013 §3.5 */
export const screenRuns = sqliteTable('screen_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  executedAt: text('executed_at').notNull(),
  preset: text('preset'),
  criteriaJson: text('criteria_json').notNull(),
  universeSize: integer('universe_size').notNull(),
  matched: integer('matched').notNull(),
})

export type ScreenRun = typeof screenRuns.$inferSelect
