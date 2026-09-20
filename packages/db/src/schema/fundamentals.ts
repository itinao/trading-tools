import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/** 日次の指標スナップショット。比率は % の値（Design Doc 0010 §3.3） */
export const fundamentals = sqliteTable(
  'fundamentals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    asOf: text('as_of').notNull(),
    per: real('per'),
    forwardPer: real('forward_per'),
    pbr: real('pbr'),
    dividendYield: real('dividend_yield'),
    marketCap: real('market_cap'),
    roe: real('roe'),
    operatingMargin: real('operating_margin'),
    revenueGrowth: real('revenue_growth'),
    debtToEquity: real('debt_to_equity'),
    nextEarningsDate: text('next_earnings_date'),
    source: text('source').notNull(),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [uniqueIndex('fundamentals_instrument_as_of_source').on(t.instrumentId, t.asOf, t.source)],
)

export type Fundamentals = typeof fundamentals.$inferSelect
export type NewFundamentals = typeof fundamentals.$inferInsert
