import type { DatabaseHandle } from '@trading/db'
import { schema } from '@trading/db'
import { desc, eq } from 'drizzle-orm'

export interface Target {
  instrumentId: string
  code: string
  /** 最新スナップショット時点の株価。モックの初期値に使う */
  priceAtSnapshot: number
}

/** 収集対象 = 最新スナップショットの銘柄（口座で重複するので distinct）。M4 でウォッチ銘柄が加わる */
export function holdingTargets(handle: DatabaseHandle): Target[] {
  const latest = handle.db
    .select({ id: schema.holdingSnapshots.id })
    .from(schema.holdingSnapshots)
    .orderBy(desc(schema.holdingSnapshots.asOf))
    .limit(1)
    .get()
  if (!latest) return []
  const rows = handle.db
    .select({
      instrumentId: schema.holdings.instrumentId,
      code: schema.instruments.code,
      priceAtSnapshot: schema.holdings.priceAtSnapshot,
    })
    .from(schema.holdings)
    .innerJoin(schema.instruments, eq(schema.holdings.instrumentId, schema.instruments.id))
    .where(eq(schema.holdings.snapshotId, latest.id))
    .all()
  const byId = new Map<string, Target>()
  for (const r of rows) if (!byId.has(r.instrumentId)) byId.set(r.instrumentId, r)
  return [...byId.values()]
}
