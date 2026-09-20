import { Logger } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'

export const NOW = '2026-01-01T00:00:00+09:00'

/** 2 銘柄を保有した状態にする */
export function seed(handle: DatabaseHandle) {
  handle.db
    .insert(schema.instruments)
    .values([
      {
        id: 'JP:1234',
        market: 'JP',
        code: '1234',
        name: 'テスト製作所',
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'JP:5678',
        market: 'JP',
        code: '5678',
        name: '株式会社サンプル商事',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])
    .run()
  const latest = handle.db
    .insert(schema.holdingSnapshots)
    .values({
      source: 'rakuten',
      asOf: NOW,
      fileName: 'new.csv',
      importedAt: NOW,
      rowCount: 2,
      skippedJson: '{}',
    })
    .returning({ id: schema.holdingSnapshots.id })
    .get()?.id as number
  const h = (instrumentId: string, account: string, price: number) => ({
    snapshotId: latest,
    instrumentId,
    account,
    quantity: 100,
    averageCost: 1000,
    priceAtSnapshot: price,
    marketValue: 100 * price,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
  })
  handle.db
    .insert(schema.holdings)
    .values([h('JP:1234', '特定', 2500), h('JP:1234', '旧NISA', 2500), h('JP:5678', '特定', 700)])
    .run()
}

export const context = (dryRun = false) => ({
  options: { dryRun, quiet: true, verbose: false },
  logger: new Logger(() => {}, 'error'),
  dbPath: ':memory:',
  readInput: <T>() => ({}) as T,
})
