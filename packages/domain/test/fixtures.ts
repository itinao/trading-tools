import { type DatabaseHandle, schema } from '@trading/db'

export const NOW = '2026-01-01T00:00:00+09:00'

/** 2銘柄、最新スナップショットで JP:1234 は2口座 */
export function seedHoldings(handle: DatabaseHandle) {
  handle.db
    .insert(schema.instruments)
    .values([
      { id: 'JP:1234', market: 'JP', code: '1234', name: 'A', createdAt: NOW, updatedAt: NOW },
      { id: 'JP:5678', market: 'JP', code: '5678', name: 'B', createdAt: NOW, updatedAt: NOW },
    ])
    .run()
  const snap = (asOf: string) =>
    handle.db
      .insert(schema.holdingSnapshots)
      .values({
        source: 'rakuten',
        asOf,
        fileName: 'x.csv',
        importedAt: NOW,
        rowCount: 0,
        skippedJson: '{}',
      })
      .returning({ id: schema.holdingSnapshots.id })
      .get()?.id as number
  const older = snap('2025-12-01T00:00:00+09:00')
  const latest = snap('2026-01-01T00:00:00+09:00')
  const h = (
    snapshotId: number,
    instrumentId: string,
    account: string,
    quantity: number,
    averageCost: number,
    price: number,
  ) => ({
    snapshotId,
    instrumentId,
    account,
    quantity,
    averageCost,
    priceAtSnapshot: price,
    marketValue: quantity * price,
    unrealizedPnl: Math.round(quantity * (price - averageCost)),
    unrealizedPnlPct: 0,
  })
  handle.db
    .insert(schema.holdings)
    .values([
      h(older, 'JP:5678', '特定', 1, 1, 1),
      h(latest, 'JP:1234', '特定', 100, 2000, 2500),
      h(latest, 'JP:1234', '旧NISA', 300, 3000, 2500),
      h(latest, 'JP:5678', '特定', 10, 700, 700),
    ])
    .run()
  return { older, latest }
}

export function seedQuotes(
  handle: DatabaseHandle,
  instrumentId: string,
  series: [string, number][],
  source = 'test',
) {
  handle.db
    .insert(schema.quotes)
    .values(
      series.map(([asOf, price]) => ({
        instrumentId,
        asOf,
        price,
        previousClose: null,
        source,
        fetchedAt: NOW,
      })),
    )
    .run()
}
