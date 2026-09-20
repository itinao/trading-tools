import type { DetectConfig } from '../config.ts'
import type { AnnualPeriod } from './financials.ts'
import { type PricePoint, pct } from './price.ts'
import { type RuleOutcome, round2 } from './types.ts'

/** 攻めのルール。ウォッチ銘柄にだけ適用する（Design Doc 0013 §3.3） */

export interface LatestFundamentals {
  per: number | null
  pbr: number | null
  dividendYield: number | null
  asOf: string
}

/** PER / PBR / 配当利回りの絶対値の閾値。値が無い項目は条件を満たさないとみなす */
export function valuationCheap(
  f: LatestFundamentals | null,
  cfg: DetectConfig['valuation_cheap'],
): RuleOutcome {
  if (!f) return { skipped: 'no fundamentals' }
  const ok =
    f.per != null &&
    f.per > 0 &&
    f.per <= cfg.perMax &&
    f.pbr != null &&
    f.pbr <= cfg.pbrMax &&
    f.dividendYield != null &&
    f.dividendYield >= cfg.dividendMin
  if (!ok) return null
  return {
    kind: 'valuation_cheap',
    severity: 'warn',
    value: f.per as number,
    details: { per: f.per, pbr: f.pbr, dividendYield: f.dividendYield, asOf: f.asOf },
  }
}

/** 年次の売上と営業利益が N 年連続で前年を上回る（periods は新しい順） */
export function growthYears(periods: AnnualPeriod[]): number {
  const usable = periods.filter((p) => p.revenue != null && p.operatingIncome != null)
  let years = 0
  for (let i = 0; i + 1 < usable.length; i++) {
    const cur = usable[i] as AnnualPeriod
    const prev = usable[i + 1] as AnnualPeriod
    if (
      (cur.revenue as number) > (prev.revenue as number) &&
      (cur.operatingIncome as number) > (prev.operatingIncome as number)
    )
      years++
    else break
  }
  return years
}

export function growthStreak(
  periods: AnnualPeriod[],
  cfg: DetectConfig['growth_streak'],
): RuleOutcome {
  const usable = periods.filter((p) => p.revenue != null && p.operatingIncome != null)
  if (usable.length < cfg.years + 1)
    return { skipped: `insufficient annual data (${usable.length} < ${cfg.years + 1})` }
  const years = growthYears(periods)
  if (years < cfg.years) return null
  return {
    kind: 'growth_streak',
    severity: 'warn',
    value: years,
    details: {
      years,
      periods: usable
        .slice(0, cfg.years + 1)
        .map((p) => `${p.periodEnd}: 売上 ${p.revenue} / 営業利益 ${p.operatingIncome}`)
        .join('; '),
    },
  }
}

/** 200 日線より下・60 日高値から大きく下落・かつ企業側の良さ（割安 or 成長）がある */
export function oversoldQuality(
  history: PricePoint[],
  cheap: RuleOutcome,
  growth: RuleOutcome,
  cfg: DetectConfig['oversold_quality'],
  windows: { ma: number; drawdown: number },
): RuleOutcome {
  if (history.length < windows.ma)
    return { skipped: `insufficient history (${history.length} < ${windows.ma})` }
  const today = history[0] as PricePoint
  const ma = history.slice(0, windows.ma).reduce((s, p) => s + p.price, 0) / windows.ma
  const window = history.slice(0, windows.drawdown)
  const high = Math.max(...window.map((p) => p.price))
  const dd = pct(today.price, high)
  const quality =
    cheap && !('skipped' in cheap)
      ? 'valuation_cheap'
      : growth && !('skipped' in growth)
        ? 'growth_streak'
        : null
  if (!(today.price < ma && dd <= cfg.drawdownMax && quality)) return null
  return {
    kind: 'oversold_quality',
    severity: 'critical',
    value: dd,
    details: { price: today.price, ma200: round2(ma), high60: high, drawdown: dd, quality },
  }
}
