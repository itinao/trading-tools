export type Severity = 'warn' | 'critical'
export type SignalKind =
  | 'price_drop_cost'
  | 'drawdown_60d'
  | 'below_ma200'
  | 'price_drop_day'
  | 'news_negative'
  | 'forecast_down'
  | 'dividend_cut'
  | 'margin_deterioration'
  | 'equity_ratio_drop'
  | 'score_low'
  | 'valuation_cheap'
  | 'growth_streak'
  | 'oversold_quality'

export const SIGNAL_KINDS: readonly SignalKind[] = [
  'price_drop_cost',
  'drawdown_60d',
  'below_ma200',
  'price_drop_day',
  'news_negative',
  'forecast_down',
  'dividend_cut',
  'margin_deterioration',
  'equity_ratio_drop',
  'score_low',
  'valuation_cheap',
  'growth_streak',
  'oversold_quality',
]

/** 攻めのルール（ウォッチ銘柄のみ） */
export const OFFENSE_KINDS: readonly SignalKind[] = [
  'valuation_cheap',
  'growth_streak',
  'oversold_quality',
]

export interface RuleHit {
  kind: SignalKind
  severity: Severity
  /** 変化率(%) や点数など、kind ごとの代表値 */
  value: number
  details: Record<string, number | string | null>
}

export type RuleOutcome = RuleHit | { skipped: string } | null

export function severityFor(value: number, warn: number, critical?: number): Severity | null {
  if (critical !== undefined && value <= critical) return 'critical'
  if (value <= warn) return 'warn'
  return null
}

export const round2 = (n: number) => Math.round(n * 100) / 100
