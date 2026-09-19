import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** 銘柄。id は `市場:コード`（例 JP:7203）。Design Doc 0003 §3.4 */
export const instruments = sqliteTable('instruments', {
  id: text('id').primaryKey(),
  market: text('market').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export type Instrument = typeof instruments.$inferSelect
export type NewInstrument = typeof instruments.$inferInsert

export function instrumentId(market: string, code: string): string {
  return `${market}:${code}`
}
