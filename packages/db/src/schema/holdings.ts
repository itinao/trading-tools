import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { holdingSnapshots } from './holding-snapshots.ts'
import { instruments } from './instruments.ts'

/** 保有明細。同じ銘柄を複数口座で持てるので account を主キーに含める */
export const holdings = sqliteTable(
  'holdings',
  {
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => holdingSnapshots.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    account: text('account').notNull(),
    quantity: integer('quantity').notNull(),
    averageCost: real('average_cost').notNull(),
    priceAtSnapshot: real('price_at_snapshot').notNull(),
    marketValue: integer('market_value').notNull(),
    unrealizedPnl: integer('unrealized_pnl').notNull(),
    unrealizedPnlPct: real('unrealized_pnl_pct').notNull(),
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.instrumentId, t.account] })],
)

export type Holding = typeof holdings.$inferSelect
export type NewHolding = typeof holdings.$inferInsert
