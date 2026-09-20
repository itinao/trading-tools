import type { ToolContext } from '@trading/cli'
import { ToolError } from '@trading/cli'
import type { DatabaseHandle } from '@trading/db'
import { type ScreenResultInput, saveScreenRun, universeRows } from '@trading/domain'
import type {
  FinancialPeriod,
  FinancialsProvider,
  FundamentalsProvider,
  QuoteMetrics,
  QuoteMetricsProvider,
} from '@trading/market-data'
import type { Criteria } from './criteria.ts'

export interface ScreenProviders {
  metrics: QuoteMetricsProvider
  financials: FinancialsProvider
  fundamentals: FundamentalsProvider
}

export interface ScreenRunResult {
  runId: number | null
  preset: string | null
  criteria: Criteria
  universeSize: number
  quoted: number
  matched: number
  results: (ScreenResultInput & { rank: number })[]
}

/** 年次の売上と営業利益が何年連続で前年を上回っているか（periods は新しい順） */
export function growthStreak(periods: FinancialPeriod[]): number {
  const annual = periods
    .filter((p) => p.periodType === 'annual' && p.revenue != null && p.operatingIncome != null)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
  let years = 0
  for (let i = 0; i + 1 < annual.length; i++) {
    const cur = annual[i] as FinancialPeriod
    const prev = annual[i + 1] as FinancialPeriod
    if (
      (cur.revenue as number) > (prev.revenue as number) &&
      (cur.operatingIncome as number) > (prev.operatingIncome as number)
    )
      years++
    else break
  }
  return years
}

const passes = (c: Criteria, m: QuoteMetrics): boolean => {
  if (c.perMax !== undefined && !(m.per !== undefined && m.per > 0 && m.per <= c.perMax))
    return false
  if (c.pbrMax !== undefined && !(m.pbr !== undefined && m.pbr <= c.pbrMax)) return false
  if (
    c.dividendMin !== undefined &&
    !(m.dividendYield !== undefined && m.dividendYield >= c.dividendMin)
  )
    return false
  if (c.marketCapMin !== undefined && !(m.marketCap !== undefined && m.marketCap >= c.marketCapMin))
    return false
  return true
}

const sortKey = (c: Criteria) => (r: ScreenResultInput) => {
  switch (c.sort) {
    case 'per':
      return r.per ?? Number.POSITIVE_INFINITY
    case 'pbr':
      return r.pbr ?? Number.POSITIVE_INFINITY
    case 'marketCap':
      return -(r.marketCap ?? 0)
    case 'growthYears':
      return -(r.growthYears ?? 0)
    default:
      return -(r.dividendYield ?? 0)
  }
}

export async function runScreen(
  handle: DatabaseHandle,
  context: ToolContext,
  input: { criteria: Criteria; preset: string | null },
  providers: ScreenProviders,
): Promise<ScreenRunResult> {
  const { criteria } = input
  const universe = universeRows(handle.db, {
    segments: criteria.segments,
    sectors: criteria.sectors,
  })
  if (universe.length === 0)
    throw new ToolError(
      'no_universe',
      '母集団が空です。先に pnpm collect universe を実行してください',
    )
  context.logger.info(`universe ${universe.length} (${criteria.segments.join(',')})`)
  const byCode = new Map(universe.map((u) => [u.code, u]))

  const metrics = await providers.metrics.fetchQuoteMetrics(universe.map((u) => u.code))
  context.logger.info(`quoted ${metrics.length}`)
  let candidates: ScreenResultInput[] = metrics
    .filter((m) => passes(criteria, m))
    .map((m) => {
      const u = byCode.get(m.code)
      return {
        code: m.code,
        name: u?.name ?? m.code,
        segment: u?.segment ?? 'other',
        sector33: u?.sector33 ?? null,
        price: m.price,
        per: m.per ?? null,
        forwardPer: m.forwardPer ?? null,
        pbr: m.pbr ?? null,
        dividendYield: m.dividendYield ?? null,
        marketCap: m.marketCap ?? null,
        growthYears: null,
      }
    })
  const needsDetail =
    criteria.growthYears !== undefined ||
    criteria.roeMin !== undefined ||
    criteria.operatingMarginMin !== undefined ||
    criteria.equityRatioMin !== undefined ||
    criteria.sort === 'growthYears'
  // 一括で取れる指標で絞ってから並べ、上位 limit 件（詳細が要る条件では余裕を見て 3 倍）だけ個別に取る
  candidates.sort((a, b) => sortKey(criteria)(a) - sortKey(criteria)(b))
  const detailCount = needsDetail ? criteria.limit * 3 : criteria.limit
  candidates = candidates.slice(0, detailCount)

  const detailed: ScreenResultInput[] = []
  for (const c of candidates) {
    let ok = true
    const fin = await providers.financials.fetchFinancials(c.code)
    const periods = fin.ok ? fin.periods : []
    c.growthYears = periods.length > 0 ? growthStreak(periods) : null
    if (criteria.growthYears !== undefined && !((c.growthYears ?? 0) >= criteria.growthYears))
      ok = false
    if (
      ok &&
      (criteria.roeMin !== undefined ||
        criteria.operatingMarginMin !== undefined ||
        criteria.equityRatioMin !== undefined)
    ) {
      const [f] = await providers.fundamentals.fetchFundamentals([c.code])
      const latestAnnual = periods
        .filter((p) => p.periodType === 'annual')
        .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0]
      const equityRatio =
        latestAnnual?.totalAssets && latestAnnual.equity != null
          ? (latestAnnual.equity / latestAnnual.totalAssets) * 100
          : undefined
      if (
        criteria.roeMin !== undefined &&
        !(f?.ok && f.roe !== undefined && f.roe >= criteria.roeMin)
      )
        ok = false
      if (
        criteria.operatingMarginMin !== undefined &&
        !(
          f?.ok &&
          f.operatingMargin !== undefined &&
          f.operatingMargin >= criteria.operatingMarginMin
        )
      )
        ok = false
      if (
        criteria.equityRatioMin !== undefined &&
        !(equityRatio !== undefined && equityRatio >= criteria.equityRatioMin)
      )
        ok = false
    }
    if (ok) detailed.push(c)
    if (detailed.length >= criteria.limit && !needsDetail) break
  }
  detailed.sort((a, b) => sortKey(criteria)(a) - sortKey(criteria)(b))
  const results = detailed.slice(0, criteria.limit).map((r, i) => ({ ...r, rank: i + 1 }))
  const runId = context.options.dryRun
    ? null
    : saveScreenRun(handle.db, {
        preset: input.preset,
        criteria,
        universeSize: universe.length,
        results,
      })
  return {
    runId,
    preset: input.preset,
    criteria,
    universeSize: universe.length,
    quoted: metrics.length,
    matched: results.length,
    results,
  }
}
