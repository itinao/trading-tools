import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/** シグナル = その日にその条件が成立した記録。kind は Design Doc 0001 付録 A。0005 §3.2 */
export const signals = sqliteTable(
  'signals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    kind: text('kind').notNull(),
    asOf: text('as_of').notNull(),
    severity: text('severity').notNull(),
    value: real('value').notNull(),
    detailsJson: text('details_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('signals_instrument_kind_as_of').on(t.instrumentId, t.kind, t.asOf),
    index('signals_instrument_as_of').on(t.instrumentId, t.asOf),
  ],
)

export type Signal = typeof signals.$inferSelect
export type NewSignal = typeof signals.$inferInsert
export type Severity = 'warn' | 'critical'
