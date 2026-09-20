import { Logger } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.ts'
import { runDetect } from '../src/run.ts'

const NOW = '2026-01-01T00:00:00+09:00'

function seed(handle: DatabaseHandle) {
  handle.db
    .insert(schema.instruments)
    .values([
      { id: 'JP:1234', market: 'JP', code: '1234', name: 'A', createdAt: NOW, updatedAt: NOW },
      { id: 'JP:5678', market: 'JP', code: '5678', name: 'B', createdAt: NOW, updatedAt: NOW },
    ])
    .run()
  const snap = handle.db
    .insert(schema.holdingSnapshots)
    .values({
      source: 'rakuten',
      asOf: NOW,
      fileName: 'x.csv',
      importedAt: NOW,
      rowCount: 2,
      skippedJson: '{}',
    })
    .returning({ id: schema.holdingSnapshots.id })
    .get()?.id as number
  handle.db
    .insert(schema.holdings)
    .values([
      {
        snapshotId: snap,
        instrumentId: 'JP:1234',
        account: '特定',
        quantity: 100,
        averageCost: 1000,
        priceAtSnapshot: 1000,
        marketValue: 100000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
      },
      {
        snapshotId: snap,
        instrumentId: 'JP:5678',
        account: '特定',
        quantity: 10,
        averageCost: 500,
        priceAtSnapshot: 500,
        marketValue: 5000,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
      },
    ])
    .run()
}

function quote(handle: DatabaseHandle, instrumentId: string, asOf: string, price: number) {
  handle.db
    .insert(schema.quotes)
    .values({ instrumentId, asOf, price, previousClose: null, source: 'test', fetchedAt: NOW })
    .onConflictDoUpdate({
      target: [schema.quotes.instrumentId, schema.quotes.asOf, schema.quotes.source],
      set: { price },
    })
    .run()
}

const context = (dryRun = false) => ({
  options: { dryRun, quiet: true, verbose: false },
  logger: new Logger(() => {}, 'error'),
  dbPath: ':memory:',
  readInput: <T>() => ({}) as T,
})
const signals = (h: DatabaseHandle) => h.db.select().from(schema.signals).all()
const actions = (h: DatabaseHandle) => h.db.select().from(schema.actions).all()

describe('runDetect', () => {
  it('--as-of 省略時は株価の最新日を評価し、株価が無ければ no_quotes', () => {
    const handle = createTestDatabase()
    seed(handle)
    expect(() => runDetect(handle, context(), {}, DEFAULT_CONFIG)).toThrow(
      expect.objectContaining({ code: 'no_quotes' }),
    )
    quote(handle, 'JP:1234', '2026-01-05', 850)
    quote(handle, 'JP:1234', '2026-01-09', 850)
    const r = runDetect(handle, context(), {}, DEFAULT_CONFIG)
    expect(r.asOf).toBe('2026-01-09')
    handle.close()
  })

  it('当日の quote がない銘柄は skipped、あれば評価してシグナルとアクションを作る', () => {
    const handle = createTestDatabase()
    seed(handle)
    quote(handle, 'JP:1234', '2026-01-05', 850) // 取得単価比 -15% → warn
    const r = runDetect(handle, context(), { asOf: '2026-01-05' }, DEFAULT_CONFIG)
    expect(r.evaluated).toBe(1)
    expect(r.skipped).toContainEqual({
      code: '5678',
      kind: 'all',
      reason: 'no quote for 2026-01-05',
    })
    expect(r.skipped).toContainEqual({
      code: '1234',
      kind: 'price_drop_day',
      reason: 'no previous quote',
    })
    expect(r.signals).toEqual({ created: 1, updated: 0 })
    expect(r.actions).toEqual({ created: 1, suppressed: 0 })
    expect(signals(handle)[0]).toMatchObject({
      instrumentId: 'JP:1234',
      kind: 'price_drop_cost',
      asOf: '2026-01-05',
      severity: 'warn',
      value: -15,
    })
    const a = actions(handle)[0]
    expect(a).toMatchObject({ instrumentId: 'JP:1234', origin: 'rule', status: 'open' })
    expect(a?.title).toBe('A: 取得単価比 -15%')
    expect(a?.body).toContain('売る / 持つの判断は人が行う')
    handle.close()
  })

  it('同日の再実行はシグナル上書き・アクション増えない', () => {
    const handle = createTestDatabase()
    seed(handle)
    quote(handle, 'JP:1234', '2026-01-05', 850)
    runDetect(handle, context(), { asOf: '2026-01-05' }, DEFAULT_CONFIG)
    quote(handle, 'JP:1234', '2026-01-05', 840)
    const r = runDetect(handle, context(), { asOf: '2026-01-05' }, DEFAULT_CONFIG)
    expect(r.signals).toEqual({ created: 0, updated: 1 })
    expect(r.actions).toEqual({ created: 0, suppressed: 1 })
    expect(signals(handle)).toHaveLength(1)
    expect(signals(handle)[0]?.value).toBe(-16)
    expect(actions(handle)).toHaveLength(1)
    handle.close()
  })

  it('翌日も条件が続く: シグナルは増える、未対応のアクションがあれば作らない', () => {
    const handle = createTestDatabase()
    seed(handle)
    quote(handle, 'JP:1234', '2026-01-05', 850)
    runDetect(handle, context(), { asOf: '2026-01-05' }, DEFAULT_CONFIG)
    quote(handle, 'JP:1234', '2026-01-06', 860)
    const r = runDetect(handle, context(), { asOf: '2026-01-06' }, DEFAULT_CONFIG)
    expect(r.signals.created).toBe(1)
    expect(r.actions).toEqual({ created: 0, suppressed: 1 })
    expect(signals(handle)).toHaveLength(2)
    expect(actions(handle)).toHaveLength(1)
    handle.close()
  })

  it('対応済みにした後、重大度が上がれば新しいアクション', () => {
    const handle = createTestDatabase()
    seed(handle)
    quote(handle, 'JP:1234', '2026-01-05', 850)
    runDetect(handle, context(), { asOf: '2026-01-05' }, DEFAULT_CONFIG)
    handle.db.update(schema.actions).set({ status: 'done' }).run()
    quote(handle, 'JP:1234', '2026-01-06', 860) // まだ warn → 作らない
    expect(runDetect(handle, context(), { asOf: '2026-01-06' }, DEFAULT_CONFIG).actions).toEqual({
      created: 0,
      suppressed: 1,
    })
    quote(handle, 'JP:1234', '2026-01-07', 800) // 取得単価比 -20% で critical → 作る（前日比は -6.98% で鳴らない）
    expect(runDetect(handle, context(), { asOf: '2026-01-07' }, DEFAULT_CONFIG).actions).toEqual({
      created: 1,
      suppressed: 0,
    })
    expect(actions(handle)).toHaveLength(2)
    handle.close()
  })

  it('対応済みから reissue_after_days 経てば再発行', () => {
    const handle = createTestDatabase()
    seed(handle)
    quote(handle, 'JP:1234', '2026-01-05', 850)
    runDetect(handle, context(), { asOf: '2026-01-05' }, DEFAULT_CONFIG)
    // 直近アクションを 40 日前・対応済みにする
    handle.db
      .update(schema.actions)
      .set({ status: 'done', createdAt: '2025-11-20T00:00:00+09:00' })
      .run()
    quote(handle, 'JP:1234', '2026-01-06', 850)
    expect(runDetect(handle, context(), { asOf: '2026-01-06' }, DEFAULT_CONFIG).actions).toEqual({
      created: 1,
      suppressed: 0,
    })
    handle.close()
  })

  it('前日比と取得単価比が同時に成立すれば kind ごとにシグナルとアクション', () => {
    const handle = createTestDatabase()
    seed(handle)
    quote(handle, 'JP:1234', '2026-01-05', 1000)
    quote(handle, 'JP:1234', '2026-01-06', 880) // 前日比 -12%、取得単価比 -12%
    const r = runDetect(handle, context(), { asOf: '2026-01-06' }, DEFAULT_CONFIG)
    expect(r.signals.created).toBe(2)
    expect(r.actions.created).toBe(2)
    expect(
      signals(handle)
        .map((s) => s.kind)
        .sort(),
    ).toEqual(['price_drop_cost', 'price_drop_day'])
    handle.close()
  })

  it('--dry-run は数えるが書かない', () => {
    const handle = createTestDatabase()
    seed(handle)
    quote(handle, 'JP:1234', '2026-01-05', 850)
    const r = runDetect(handle, context(true), { asOf: '2026-01-05' }, DEFAULT_CONFIG)
    expect(r.signals.created).toBe(1)
    expect(r.actions.created).toBe(1)
    expect(signals(handle)).toHaveLength(0)
    expect(actions(handle)).toHaveLength(0)
    handle.close()
  })

  it('閾値内なら何も作らない', () => {
    const handle = createTestDatabase()
    seed(handle)
    quote(handle, 'JP:1234', '2026-01-05', 950)
    const r = runDetect(handle, context(), { asOf: '2026-01-05' }, DEFAULT_CONFIG)
    expect(r.signals.created).toBe(0)
    expect(signals(handle)).toHaveLength(0)
    expect(
      handle.db
        .select()
        .from(schema.actions)
        .where(eq(schema.actions.instrumentId, 'JP:1234'))
        .all(),
    ).toHaveLength(0)
    handle.close()
  })
})
