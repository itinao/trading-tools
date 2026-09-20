import type { DetectConfig } from '../config.ts'
import {
  type RuleHit,
  type RuleOutcome,
  round2,
  type Severity,
  type SignalKind,
  severityFor,
} from './types.ts'

export type { RuleHit, RuleOutcome, Severity, SignalKind }

/** 株価の履歴。[0] が as_of 当日、以降が古い順（新しい順に並んだ配列） */
export interface PricePoint {
  asOf: string
  price: number
  previousClose?: number | null
}

export function pct(current: number, base: number): number {
  return round2(((current - base) / base) * 100)
}

export function priceDropCost(
  today: PricePoint,
  averageCost: number,
  cfg: DetectConfig['price_drop_cost'],
): RuleOutcome {
  if (averageCost <= 0) return { skipped: 'no average cost' }
  const value = pct(today.price, averageCost)
  const severity = severityFor(value, cfg.warn, cfg.critical)
  if (!severity) return null
  return {
    kind: 'price_drop_cost',
    severity,
    value,
    details: { price: today.price, averageCost: round2(averageCost) },
  }
}

export function drawdown60d(history: PricePoint[], cfg: DetectConfig['drawdown_60d']): RuleOutcome {
  const window = history.slice(0, cfg.window)
  if (window.length < cfg.minHistory)
    return { skipped: `insufficient history (${window.length} < ${cfg.minHistory})` }
  const today = window[0] as PricePoint
  let high = window[0] as PricePoint
  for (const p of window) if (p.price > high.price) high = p
  const value = pct(today.price, high.price)
  const severity = severityFor(value, cfg.warn, cfg.critical)
  if (!severity) return null
  return {
    kind: 'drawdown_60d',
    severity,
    value,
    details: { price: today.price, high: high.price, highAsOf: high.asOf, window: window.length },
  }
}

/** 200 日線を上から下へ抜けた日だけ鳴る。当日の MA と前日の MA の両方に window 本必要 */
export function belowMa200(history: PricePoint[], cfg: DetectConfig['below_ma200']): RuleOutcome {
  const need = cfg.window + 1
  if (history.length < need)
    return { skipped: `insufficient history (${history.length} < ${need})` }
  const avg = (from: number) =>
    history.slice(from, from + cfg.window).reduce((s, p) => s + p.price, 0) / cfg.window
  const today = history[0] as PricePoint
  const yesterday = history[1] as PricePoint
  const maToday = avg(0)
  const maYesterday = avg(1)
  if (!(today.price < maToday && yesterday.price >= maYesterday)) return null
  return {
    kind: 'below_ma200',
    severity: 'warn',
    value: pct(today.price, maToday),
    details: {
      price: today.price,
      ma: round2(maToday),
      previousPrice: yesterday.price,
      previousMa: round2(maYesterday),
    },
  }
}

export function priceDropDay(
  history: PricePoint[],
  cfg: DetectConfig['price_drop_day'],
): RuleOutcome {
  const today = history[0] as PricePoint
  const previous = history[1]?.price ?? today.previousClose ?? null
  if (previous == null || previous <= 0) return { skipped: 'no previous quote' }
  const value = pct(today.price, previous)
  const severity = severityFor(value, cfg.warn)
  if (!severity) return null
  return {
    kind: 'price_drop_day',
    severity,
    value,
    details: { price: today.price, previous, previousAsOf: history[1]?.asOf ?? 'previous_close' },
  }
}

export type PriceKind = 'price_drop_cost' | 'drawdown_60d' | 'below_ma200' | 'price_drop_day'

export function evaluatePriceRules(
  history: PricePoint[],
  averageCost: number,
  cfg: DetectConfig,
): Record<PriceKind, RuleOutcome> {
  const today = history[0] as PricePoint
  return {
    price_drop_cost: priceDropCost(today, averageCost, cfg.price_drop_cost),
    drawdown_60d: drawdown60d(history, cfg.drawdown_60d),
    below_ma200: belowMa200(history, cfg.below_ma200),
    price_drop_day: priceDropDay(history, cfg.price_drop_day),
  }
}
