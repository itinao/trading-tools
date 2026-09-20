import { nowJst, type ToolContext, ToolError, todayJst } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import type { FundamentalsProvider } from '@trading/market-data'
import { sql } from 'drizzle-orm'
import { type Failed, logFailures, requireTargets } from './shared.ts'

export interface FundamentalsResult {
  asOf: string
  provider: string
  fetched: number
  failed: Failed[]
}

/** 指標の日次スナップショット。as_of は実行日（指標に引け時刻の概念がないため） */
export async function collectFundamentals(
  handle: DatabaseHandle,
  context: ToolContext,
  provider: FundamentalsProvider,
): Promise<FundamentalsResult> {
  const targets = requireTargets(handle)
  const asOf = todayJst()
  const fetchedAt = nowJst()
  const byCode = new Map(targets.map((t) => [t.code, t]))
  const results = await provider.fetchFundamentals(targets.map((t) => t.code))
  const failed: Failed[] = []
  const rows: (typeof schema.fundamentals.$inferInsert)[] = []
  for (const r of results) {
    const target = byCode.get(r.code)
    if (!target) continue
    if (!r.ok) {
      failed.push({ code: r.code, reason: r.reason })
      continue
    }
    rows.push({
      instrumentId: target.instrumentId,
      asOf,
      per: r.per ?? null,
      forwardPer: r.forwardPer ?? null,
      pbr: r.pbr ?? null,
      dividendYield: r.dividendYield ?? null,
      marketCap: r.marketCap ?? null,
      roe: r.roe ?? null,
      operatingMargin: r.operatingMargin ?? null,
      revenueGrowth: r.revenueGrowth ?? null,
      debtToEquity: r.debtToEquity ?? null,
      nextEarningsDate: r.nextEarningsDate ?? null,
      source: provider.name,
      fetchedAt,
    })
  }
  if (rows.length === 0)
    throw new ToolError('all_failed', 'すべての銘柄で取得に失敗しました', { details: { failed } })
  logFailures(context, failed)
  if (!context.options.dryRun) {
    handle.db
      .insert(schema.fundamentals)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          schema.fundamentals.instrumentId,
          schema.fundamentals.asOf,
          schema.fundamentals.source,
        ],
        set: {
          per: sql`excluded.per`,
          forwardPer: sql`excluded.forward_per`,
          pbr: sql`excluded.pbr`,
          dividendYield: sql`excluded.dividend_yield`,
          marketCap: sql`excluded.market_cap`,
          roe: sql`excluded.roe`,
          operatingMargin: sql`excluded.operating_margin`,
          revenueGrowth: sql`excluded.revenue_growth`,
          debtToEquity: sql`excluded.debt_to_equity`,
          nextEarningsDate: sql`excluded.next_earnings_date`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      })
      .run()
  }
  return { asOf, provider: provider.name, fetched: rows.length, failed }
}
