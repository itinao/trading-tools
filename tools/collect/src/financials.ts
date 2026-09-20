import { nowJst, type ToolContext, ToolError } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import type { FinancialsProvider } from '@trading/market-data'
import { sql } from 'drizzle-orm'
import { type Failed, logFailures, requireTargets } from './shared.ts'

export interface FinancialsResult {
  provider: string
  fetched: number
  periods: number
  failed: Failed[]
}

/** 財務諸表（年次・四半期）。(instrument, period_type, period_end, source) で上書き */
export async function collectFinancials(
  handle: DatabaseHandle,
  context: ToolContext,
  provider: FinancialsProvider,
): Promise<FinancialsResult> {
  const targets = requireTargets(handle)
  const fetchedAt = nowJst()
  const failed: Failed[] = []
  const rows: (typeof schema.financials.$inferInsert)[] = []
  let fetched = 0
  for (const t of targets) {
    const r = await provider.fetchFinancials(t.code)
    if (!r.ok) {
      failed.push({ code: t.code, reason: r.reason })
      continue
    }
    fetched++
    for (const p of r.periods) {
      rows.push({
        instrumentId: t.instrumentId,
        periodType: p.periodType,
        periodEnd: p.periodEnd,
        source: provider.name,
        revenue: p.revenue ?? null,
        operatingIncome: p.operatingIncome ?? null,
        netIncome: p.netIncome ?? null,
        totalAssets: p.totalAssets ?? null,
        equity: p.equity ?? null,
        operatingCashFlow: p.operatingCashFlow ?? null,
        eps: p.eps ?? null,
        fetchedAt,
      })
    }
  }
  if (fetched === 0)
    throw new ToolError('all_failed', 'すべての銘柄で取得に失敗しました', { details: { failed } })
  logFailures(context, failed)
  if (!context.options.dryRun && rows.length > 0) {
    handle.db
      .insert(schema.financials)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          schema.financials.instrumentId,
          schema.financials.periodType,
          schema.financials.periodEnd,
          schema.financials.source,
        ],
        set: {
          revenue: sql`excluded.revenue`,
          operatingIncome: sql`excluded.operating_income`,
          netIncome: sql`excluded.net_income`,
          totalAssets: sql`excluded.total_assets`,
          equity: sql`excluded.equity`,
          operatingCashFlow: sql`excluded.operating_cash_flow`,
          eps: sql`excluded.eps`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      })
      .run()
  }
  return { provider: provider.name, fetched, periods: rows.length, failed }
}
