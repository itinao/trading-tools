import { schema, type TradingDatabase } from '@trading/db'
import { desc, eq } from 'drizzle-orm'

/** 銘柄のニュース（新しい順） */
export function recentNews(db: TradingDatabase, instrumentId: string, limit = 20) {
  return db
    .select()
    .from(schema.newsItems)
    .where(eq(schema.newsItems.instrumentId, instrumentId))
    .orderBy(desc(schema.newsItems.publishedAt), desc(schema.newsItems.id))
    .limit(limit)
    .all()
}

/** 銘柄の適時開示（新しい順） */
export function recentDisclosures(db: TradingDatabase, instrumentId: string, limit = 20) {
  return db
    .select()
    .from(schema.disclosures)
    .where(eq(schema.disclosures.instrumentId, instrumentId))
    .orderBy(desc(schema.disclosures.disclosedAt), desc(schema.disclosures.id))
    .limit(limit)
    .all()
}

/** 銘柄の最新の指標 */
export function latestFundamentals(db: TradingDatabase, instrumentId: string) {
  return db
    .select()
    .from(schema.fundamentals)
    .where(eq(schema.fundamentals.instrumentId, instrumentId))
    .orderBy(desc(schema.fundamentals.asOf), desc(schema.fundamentals.fetchedAt))
    .limit(1)
    .get()
}

/** 銘柄の財務諸表（期の新しい順） */
export function financialHistory(
  db: TradingDatabase,
  instrumentId: string,
  periodType: 'annual' | 'quarterly' = 'annual',
) {
  return db
    .select()
    .from(schema.financials)
    .where(eq(schema.financials.instrumentId, instrumentId))
    .orderBy(desc(schema.financials.periodEnd))
    .all()
    .filter((r) => r.periodType === periodType)
}
