import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/** 日次の株価。(instrument_id, as_of, source) で一意。同日の再取得は上書き */
export const quotes = sqliteTable(
  'quotes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    asOf: text('as_of').notNull(),
    price: real('price').notNull(),
    previousClose: real('previous_close'),
    source: text('source').notNull(),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [
    uniqueIndex('quotes_instrument_as_of_source').on(t.instrumentId, t.asOf, t.source),
    index('quotes_instrument_as_of').on(t.instrumentId, t.asOf),
  ],
)

export type Quote = typeof quotes.$inferSelect
export type NewQuote = typeof quotes.$inferInsert
