import { primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/** 財務諸表（年次が主。四半期も取れれば保存する）。金額は円。Design Doc 0010 §3.3 */
export const financials = sqliteTable(
  'financials',
  {
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    periodType: text('period_type').notNull(),
    periodEnd: text('period_end').notNull(),
    source: text('source').notNull(),
    revenue: real('revenue'),
    operatingIncome: real('operating_income'),
    netIncome: real('net_income'),
    totalAssets: real('total_assets'),
    equity: real('equity'),
    operatingCashFlow: real('operating_cash_flow'),
    eps: real('eps'),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.instrumentId, t.periodType, t.periodEnd, t.source] })],
)

export type Financials = typeof financials.$inferSelect
export type NewFinancials = typeof financials.$inferInsert
export type PeriodType = 'annual' | 'quarterly'
