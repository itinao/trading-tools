import { nowJst } from '@trading/cli'
import { schema, type TradingDatabase } from '@trading/db'

export type ActionStatus = (typeof schema.ACTION_STATUSES)[number]

import { and, desc, eq, sql } from 'drizzle-orm'

export interface ActionView {
  id: number
  instrumentId: string
  code: string
  name: string
  signalId: number | null
  kind: string | null
  severity: string | null
  value: number | null
  origin: string
  title: string
  body: string
  status: string
  note: string | null
  createdAt: string
  resolvedAt: string | null
}

const severityOrder = sql<number>`case ${schema.signals.severity} when 'critical' then 0 when 'warn' then 1 else 2 end`

/** アクション一覧。status 指定なしは全部。重大度 → 新しい順 */
export function listActions(
  db: TradingDatabase,
  filter: { status?: ActionStatus | 'all'; instrumentId?: string } = {},
): ActionView[] {
  const conditions = []
  if (filter.status && filter.status !== 'all')
    conditions.push(eq(schema.actions.status, filter.status))
  if (filter.instrumentId) conditions.push(eq(schema.actions.instrumentId, filter.instrumentId))
  return db
    .select({
      id: schema.actions.id,
      instrumentId: schema.actions.instrumentId,
      code: schema.instruments.code,
      name: schema.instruments.name,
      signalId: schema.actions.signalId,
      kind: schema.signals.kind,
      severity: schema.signals.severity,
      value: schema.signals.value,
      origin: schema.actions.origin,
      title: schema.actions.title,
      body: schema.actions.body,
      status: schema.actions.status,
      note: schema.actions.note,
      createdAt: schema.actions.createdAt,
      resolvedAt: schema.actions.resolvedAt,
    })
    .from(schema.actions)
    .innerJoin(schema.instruments, eq(schema.actions.instrumentId, schema.instruments.id))
    .leftJoin(schema.signals, eq(schema.actions.signalId, schema.signals.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(severityOrder, desc(schema.actions.createdAt), desc(schema.actions.id))
    .all()
}

export function getAction(db: TradingDatabase, id: number): ActionView | undefined {
  return listActions(db).find((a) => a.id === id)
}

/**
 * アクションの状態変更。CLI（actions resolve）とダッシュボードが共有する。
 * open に戻すと resolved_at は NULL。
 */
export function setActionStatus(
  db: TradingDatabase,
  id: number,
  status: ActionStatus,
  note?: string,
): { id: number; status: ActionStatus; resolvedAt: string | null } | undefined {
  const exists = db
    .select({ id: schema.actions.id })
    .from(schema.actions)
    .where(eq(schema.actions.id, id))
    .get()
  if (!exists) return undefined
  const resolvedAt = status === 'open' ? null : nowJst()
  db.update(schema.actions)
    .set({ status, resolvedAt, ...(note === undefined ? {} : { note }) })
    .where(eq(schema.actions.id, id))
    .run()
  return { id, status, resolvedAt }
}
