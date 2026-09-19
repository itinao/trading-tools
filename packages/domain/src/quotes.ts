import { schema, type TradingDatabase } from '@trading/db'
import { and, desc, eq, lte, max, sql } from 'drizzle-orm'

/** as_of 以前の株価を新しい順に limit 件（source は問わない。同日に複数 source があれば新しく取得した方） */
export function quoteHistory(
  db: TradingDatabase,
  instrumentId: string,
  options: { upTo?: string; limit?: number } = {},
) {
  const where = options.upTo
    ? and(eq(schema.quotes.instrumentId, instrumentId), lte(schema.quotes.asOf, options.upTo))
    : eq(schema.quotes.instrumentId, instrumentId)
  return db
    .select()
    .from(schema.quotes)
    .where(where)
    .orderBy(desc(schema.quotes.asOf), desc(schema.quotes.fetchedAt))
    .limit(options.limit ?? 250)
    .all()
}

/** 全銘柄の最新の as_of（ダッシュボードの「株価の最終取得日」） */
export function latestQuoteDate(db: TradingDatabase): string | undefined {
  return (
    db
      .select({ v: max(schema.quotes.asOf) })
      .from(schema.quotes)
      .get()?.v ?? undefined
  )
}

/** 各銘柄の最新の株価（as_of 以前） */
export function latestQuotes(
  db: TradingDatabase,
  upTo?: string,
): Map<string, typeof schema.quotes.$inferSelect> {
  const rows = db
    .select()
    .from(schema.quotes)
    .where(upTo ? lte(schema.quotes.asOf, upTo) : sql`1 = 1`)
    .orderBy(desc(schema.quotes.asOf), desc(schema.quotes.fetchedAt))
    .all()
  const byInstrument = new Map<string, typeof schema.quotes.$inferSelect>()
  for (const r of rows) if (!byInstrument.has(r.instrumentId)) byInstrument.set(r.instrumentId, r)
  return byInstrument
}
