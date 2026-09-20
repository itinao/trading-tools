import type { ScoreComponents } from '@trading/domain'
import type { DetectConfig } from './config.ts'
import type { DatedAssessment } from './rules/assessment.ts'
import { type AnnualPeriod, financialChanges } from './rules/financials.ts'
import { type PricePoint, pct } from './rules/price.ts'
import { type RuleOutcome, round2, severityFor } from './rules/types.ts'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * 銘柄の「企業・株式としての状態」を -100..100 にする（Design Doc 0011 §3.4）。
 * 個人の損益は含めない。内訳と注記を返す。
 */
export function computeScore(
  input: {
    asOf: string
    history: PricePoint[]
    assessments: DatedAssessment[]
    annual: AnnualPeriod[]
  },
  cfg: DetectConfig,
): { score: number; components: ScoreComponents } {
  const notes: string[] = []
  const { asOf } = input

  // 判定: sentiment × impact × 減衰 × scale。irrelevant は除く
  const a = cfg.score.assessment
  let assessment = 0
  let counted = 0
  for (const x of input.assessments) {
    if (x.relevance !== 'relevant') continue
    // 経過日数は日付単位（当日 = 0）。時刻で減衰がぶれないように
    const ageDays = (Date.parse(asOf) - Date.parse(x.subjectAt.slice(0, 10))) / 86_400_000
    if (ageDays < 0 || ageDays > a.windowDays) continue
    assessment += x.sentiment * x.impact * 0.5 ** (ageDays / a.halfLifeDays) * a.scale
    counted++
  }
  assessment = round2(clamp(assessment, -a.cap, a.cap))
  if (counted === 0) notes.push('判定なし')

  // 株価: 60 日高値からの下落率 × factor（下落のみ）+ 200 日線より下なら penalty
  const p = cfg.score.price
  let price = 0
  const window = input.history.slice(0, cfg.drawdown_60d.window)
  const today = window[0]
  if (today && window.length >= cfg.drawdown_60d.minHistory) {
    const high = Math.max(...window.map((q) => q.price))
    const dd = pct(today.price, high)
    if (dd < 0) price += dd * p.drawdownFactor
  } else notes.push('株価履歴が不足')
  if (today && input.history.length >= cfg.below_ma200.window) {
    const ma =
      input.history.slice(0, cfg.below_ma200.window).reduce((s, q) => s + q.price, 0) /
      cfg.below_ma200.window
    if (today.price < ma) price += p.belowMaPenalty
  }
  price = round2(clamp(price, p.floor, 0))

  // 財務: 年次の前年比変化（pt）
  const f = cfg.score.financials
  const ch = financialChanges(input.annual)
  let financials = 0
  if (ch.marginDelta == null && ch.equityRatioDelta == null) notes.push('年次財務なし')
  if (ch.marginDelta != null) financials += ch.marginDelta * f.marginFactor
  if (ch.equityRatioDelta != null) financials += ch.equityRatioDelta * f.equityFactor
  financials = round2(clamp(financials, -f.cap, f.cap))

  const score = round2(clamp(assessment + price + financials, -100, 100))
  return { score, components: { assessment, price, financials, notes } }
}

export function scoreLow(score: number, cfg: DetectConfig['score_low']): RuleOutcome {
  const severity = severityFor(score, cfg.warn, cfg.critical)
  if (!severity) return null
  return { kind: 'score_low', severity, value: score, details: { score } }
}
