import { schema, type TradingDatabase } from '@trading/db'
import { desc, eq } from 'drizzle-orm'

export function latestSnapshot(db: TradingDatabase) {
  return db
    .select()
    .from(schema.holdingSnapshots)
    .orderBy(desc(schema.holdingSnapshots.asOf))
    .limit(1)
    .get()
}

export interface HoldingAccountRow {
  account: string
  quantity: number
  averageCost: number
  priceAtSnapshot: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
}

/** 銘柄ごとに口座を束ねた保有。取得単価は数量加重平均（0005 §3.1） */
export interface Position {
  instrumentId: string
  code: string
  name: string
  quantity: number
  averageCost: number
  priceAtSnapshot: number
  marketValue: number
  unrealizedPnl: number
  accounts: HoldingAccountRow[]
}

/** 最新スナップショットの保有を銘柄単位で返す。スナップショットがなければ空 */
export function positions(db: TradingDatabase, snapshotId?: number): Position[] {
  const id = snapshotId ?? latestSnapshot(db)?.id
  if (id === undefined) return []
  const rows = db
    .select({
      instrumentId: schema.holdings.instrumentId,
      code: schema.instruments.code,
      name: schema.instruments.name,
      account: schema.holdings.account,
      quantity: schema.holdings.quantity,
      averageCost: schema.holdings.averageCost,
      priceAtSnapshot: schema.holdings.priceAtSnapshot,
      marketValue: schema.holdings.marketValue,
      unrealizedPnl: schema.holdings.unrealizedPnl,
      unrealizedPnlPct: schema.holdings.unrealizedPnlPct,
    })
    .from(schema.holdings)
    .innerJoin(schema.instruments, eq(schema.holdings.instrumentId, schema.instruments.id))
    .where(eq(schema.holdings.snapshotId, id))
    .orderBy(schema.instruments.code, schema.holdings.account)
    .all()

  const byId = new Map<string, Position>()
  for (const r of rows) {
    const { instrumentId, code, name, ...account } = r
    let p = byId.get(instrumentId)
    if (!p) {
      p = {
        instrumentId,
        code,
        name,
        quantity: 0,
        averageCost: 0,
        priceAtSnapshot: r.priceAtSnapshot,
        marketValue: 0,
        unrealizedPnl: 0,
        accounts: [],
      }
      byId.set(instrumentId, p)
    }
    p.accounts.push(account)
    p.quantity += r.quantity
    p.marketValue += r.marketValue
    p.unrealizedPnl += r.unrealizedPnl
  }
  for (const p of byId.values()) {
    const cost = p.accounts.reduce((s, a) => s + a.quantity * a.averageCost, 0)
    p.averageCost = p.quantity > 0 ? cost / p.quantity : 0
  }
  return [...byId.values()]
}

export interface Target {
  instrumentId: string
  code: string
  /** 最新スナップショット時点の株価。モックの初期値に使う */
  priceAtSnapshot: number
}

/** 収集・検知の対象 = 最新スナップショットの銘柄。M4 でウォッチ銘柄が加わる */
export function holdingTargets(db: TradingDatabase): Target[] {
  return positions(db).map(({ instrumentId, code, priceAtSnapshot }) => ({
    instrumentId,
    code,
    priceAtSnapshot,
  }))
}
