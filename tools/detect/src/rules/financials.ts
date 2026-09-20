import type { DetectConfig } from '../config.ts'
import { type RuleOutcome, round2, severityFor } from './types.ts'

export interface AnnualPeriod {
  periodEnd: string
  revenue: number | null
  operatingIncome: number | null
  totalAssets: number | null
  equity: number | null
}

const margin = (p: AnnualPeriod) =>
  p.revenue && p.operatingIncome != null && p.revenue > 0
    ? (p.operatingIncome / p.revenue) * 100
    : null
const equityRatio = (p: AnnualPeriod) =>
  p.totalAssets && p.equity != null && p.totalAssets > 0 ? (p.equity / p.totalAssets) * 100 : null

/** 年次の直近 2 期。periods は期の新しい順 */
function latestTwo(
  periods: AnnualPeriod[],
  metric: (p: AnnualPeriod) => number | null,
):
  | { current: AnnualPeriod; previous: AnnualPeriod; cur: number; prev: number }
  | { skipped: string } {
  const usable = periods.filter((p) => metric(p) != null)
  if (usable.length < 2) return { skipped: `insufficient annual data (${usable.length} < 2)` }
  const [current, previous] = usable as [AnnualPeriod, AnnualPeriod]
  return { current, previous, cur: metric(current) as number, prev: metric(previous) as number }
}

/** 営業利益率の前年比の変化（pt）。悪化で鳴る */
export function marginDeterioration(
  periods: AnnualPeriod[],
  cfg: DetectConfig['margin_deterioration'],
): RuleOutcome {
  const r = latestTwo(periods, margin)
  if ('skipped' in r) return r
  const value = round2(r.cur - r.prev)
  const severity = severityFor(value, cfg.warn, cfg.critical)
  if (!severity) return null
  return {
    kind: 'margin_deterioration',
    severity,
    value,
    details: {
      currentPeriod: r.current.periodEnd,
      previousPeriod: r.previous.periodEnd,
      currentMargin: round2(r.cur),
      previousMargin: round2(r.prev),
      currentRevenue: r.current.revenue,
      currentOperatingIncome: r.current.operatingIncome,
      previousRevenue: r.previous.revenue,
      previousOperatingIncome: r.previous.operatingIncome,
    },
  }
}

/** 自己資本比率の前年比の変化（pt）。低下で鳴る */
export function equityRatioDrop(
  periods: AnnualPeriod[],
  cfg: DetectConfig['equity_ratio_drop'],
): RuleOutcome {
  const r = latestTwo(periods, equityRatio)
  if ('skipped' in r) return r
  const value = round2(r.cur - r.prev)
  const severity = severityFor(value, cfg.warn, cfg.critical)
  if (!severity) return null
  return {
    kind: 'equity_ratio_drop',
    severity,
    value,
    details: {
      currentPeriod: r.current.periodEnd,
      previousPeriod: r.previous.periodEnd,
      currentRatio: round2(r.cur),
      previousRatio: round2(r.prev),
      currentAssets: r.current.totalAssets,
      currentEquity: r.current.equity,
      previousAssets: r.previous.totalAssets,
      previousEquity: r.previous.equity,
    },
  }
}

/** スコアの財務成分に使う変化量（pt）。データが無ければ null */
export function financialChanges(periods: AnnualPeriod[]): {
  marginDelta: number | null
  equityRatioDelta: number | null
} {
  const m = latestTwo(periods, margin)
  const e = latestTwo(periods, equityRatio)
  return {
    marginDelta: 'skipped' in m ? null : round2(m.cur - m.prev),
    equityRatioDelta: 'skipped' in e ? null : round2(e.cur - e.prev),
  }
}
