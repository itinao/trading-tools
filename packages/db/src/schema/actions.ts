import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'
import { signals } from './signals.ts'

/** アクション = 利用者がやるべきこと。0005 §3.2 */
export const actions = sqliteTable(
  'actions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    signalId: integer('signal_id').references(() => signals.id),
    origin: text('origin').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    resolvedAt: text('resolved_at'),
  },
  (t) => [
    uniqueIndex('actions_signal_origin').on(t.signalId, t.origin),
    index('actions_status_created').on(t.status, t.createdAt),
    index('actions_instrument_created').on(t.instrumentId, t.createdAt),
  ],
)

export type Action = typeof actions.$inferSelect
export type NewAction = typeof actions.$inferInsert
export type ActionStatus = 'open' | 'done' | 'dismissed'
export type ActionOrigin = 'rule' | 'ai' | 'manual'
export const ACTION_STATUSES: readonly ActionStatus[] = ['open', 'done', 'dismissed']
