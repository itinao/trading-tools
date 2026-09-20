import { nowJst } from '@trading/cli'
import { schema, type TradingDatabase } from '@trading/db'
import { eq } from 'drizzle-orm'
import { type Position, positions } from './holdings.ts'
import { findUniverse } from './universe.ts'

/** 監視対象 = 最新スナップショットの保有 ∪ ウォッチ。Design Doc 0013 §3.1 */
export interface MonitoredInstrument {
  instrumentId: string
  code: string
  name: string
  context: 'holding' | 'watch'
  position: Position | null
  watch: { addedAt: string; note: string | null; source: string } | null
  /** モックの初期値用。保有は取込時の株価、ウォッチは null */
  priceAtSnapshot: number | null
}

export function monitoredInstruments(db: TradingDatabase): MonitoredInstrument[] {
  const out = new Map<string, MonitoredInstrument>()
  for (const p of positions(db)) {
    out.set(p.instrumentId, {
      instrumentId: p.instrumentId,
      code: p.code,
      name: p.name,
      context: 'holding',
      position: p,
      watch: null,
      priceAtSnapshot: p.priceAtSnapshot,
    })
  }
  const rows = db
    .select({
      instrumentId: schema.watches.instrumentId,
      addedAt: schema.watches.addedAt,
      note: schema.watches.note,
      source: schema.watches.source,
      code: schema.instruments.code,
      name: schema.instruments.name,
    })
    .from(schema.watches)
    .innerJoin(schema.instruments, eq(schema.watches.instrumentId, schema.instruments.id))
    .orderBy(schema.instruments.code)
    .all()
  for (const w of rows) {
    const existing = out.get(w.instrumentId)
    const watch = { addedAt: w.addedAt, note: w.note, source: w.source }
    if (existing) existing.watch = watch
    else
      out.set(w.instrumentId, {
        instrumentId: w.instrumentId,
        code: w.code,
        name: w.name,
        context: 'watch',
        position: null,
        watch,
        priceAtSnapshot: null,
      })
  }
  return [...out.values()]
}

/** 収集対象（0003 の Target 互換）。保有 ∪ ウォッチ */
export function monitoredTargets(
  db: TradingDatabase,
): { instrumentId: string; code: string; priceAtSnapshot: number }[] {
  return monitoredInstruments(db).map((m) => ({
    instrumentId: m.instrumentId,
    code: m.code,
    priceAtSnapshot: m.priceAtSnapshot ?? 0,
  }))
}

export class WatchError extends Error {
  constructor(
    readonly code: 'already_held' | 'already_watched' | 'name_required' | 'not_watched',
    message: string,
  ) {
    super(message)
    this.name = 'WatchError'
  }
}

/** ウォッチに追加する。銘柄が無ければ universe の名前で作る（無ければ name が必須） */
export function addWatch(
  db: TradingDatabase,
  code: string,
  options: { name?: string; note?: string; source?: string; screenRunId?: number } = {},
) {
  const id = schema.instrumentId('JP', code)
  const now = nowJst()
  if (positions(db).some((p) => p.instrumentId === id))
    throw new WatchError('already_held', `${code} は保有中です（保有銘柄は既に監視されています）`)
  if (
    db
      .select({ id: schema.watches.instrumentId })
      .from(schema.watches)
      .where(eq(schema.watches.instrumentId, id))
      .get()
  ) {
    throw new WatchError('already_watched', `${code} は既にウォッチ中です`)
  }
  const existing = db.select().from(schema.instruments).where(eq(schema.instruments.id, id)).get()
  const name = options.name ?? existing?.name ?? findUniverse(db, code)?.name
  if (!name)
    throw new WatchError(
      'name_required',
      `${code} の銘柄名が分かりません。--name で指定するか、pnpm collect universe を実行してください`,
    )
  if (!existing)
    db.insert(schema.instruments)
      .values({ id, market: 'JP', code, name, createdAt: now, updatedAt: now })
      .run()
  db.insert(schema.watches)
    .values({
      instrumentId: id,
      addedAt: now,
      note: options.note ?? null,
      source: options.source ?? 'manual',
      screenRunId: options.screenRunId ?? null,
    })
    .run()
  return { instrumentId: id, code, name, addedAt: now }
}

export function removeWatch(db: TradingDatabase, code: string): { instrumentId: string } {
  const id = schema.instrumentId('JP', code)
  const r = db.delete(schema.watches).where(eq(schema.watches.instrumentId, id)).run()
  if (r.changes === 0) throw new WatchError('not_watched', `${code} はウォッチにありません`)
  return { instrumentId: id }
}

export function listWatches(db: TradingDatabase): MonitoredInstrument[] {
  return monitoredInstruments(db).filter((m) => m.watch !== null)
}
