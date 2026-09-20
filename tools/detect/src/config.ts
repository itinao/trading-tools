import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot, ToolError } from '@trading/cli'

/** 閾値と係数。config/detect.json で上書きできる（Design Doc 0005 §3.1、0011 §3.4 / §3.5） */
export interface DetectConfig {
  price_drop_cost: { warn: number; critical: number }
  drawdown_60d: { warn: number; critical: number; window: number; minHistory: number }
  below_ma200: { window: number }
  price_drop_day: { warn: number }
  news_negative: { windowDays: number; minImpact: number; maxSentiment: number }
  forecast_down: { windowDays: number }
  dividend_cut: { windowDays: number }
  margin_deterioration: { warn: number; critical: number }
  equity_ratio_drop: { warn: number; critical: number }
  score_low: { warn: number; critical: number }
  valuation_cheap: { perMax: number; pbrMax: number; dividendMin: number }
  growth_streak: { years: number }
  oversold_quality: { drawdownMax: number }
  score: {
    assessment: { windowDays: number; halfLifeDays: number; scale: number; cap: number }
    price: { drawdownFactor: number; belowMaPenalty: number; floor: number }
    financials: { marginFactor: number; equityFactor: number; cap: number }
  }
  reissue_after_days: number
}

export const DEFAULT_CONFIG: DetectConfig = {
  price_drop_cost: { warn: -10, critical: -20 },
  drawdown_60d: { warn: -15, critical: -25, window: 60, minHistory: 20 },
  below_ma200: { window: 200 },
  price_drop_day: { warn: -7 },
  news_negative: { windowDays: 7, minImpact: 2, maxSentiment: -1 },
  forecast_down: { windowDays: 30 },
  dividend_cut: { windowDays: 30 },
  margin_deterioration: { warn: -3, critical: -6 },
  equity_ratio_drop: { warn: -5, critical: -10 },
  score_low: { warn: -40, critical: -60 },
  valuation_cheap: { perMax: 12, pbrMax: 1.0, dividendMin: 3.0 },
  growth_streak: { years: 3 },
  oversold_quality: { drawdownMax: -15 },
  score: {
    assessment: { windowDays: 30, halfLifeDays: 14, scale: 5, cap: 50 },
    price: { drawdownFactor: 0.5, belowMaPenalty: -10, floor: -40 },
    financials: { marginFactor: 2, equityFactor: 1, cap: 20 },
  },
  reissue_after_days: 30,
}

export const CONFIG_PATH = 'config/detect.json'

export function loadConfig(root: string = findWorkspaceRoot()): DetectConfig {
  const path = join(root, CONFIG_PATH)
  if (!existsSync(path)) return DEFAULT_CONFIG
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (cause) {
    throw new ToolError('bad_config', `${CONFIG_PATH} を JSON として読めません`, {
      details: String(cause),
    })
  }
  return mergeConfig(raw)
}

/** 既定値に部分指定を重ねる。数値であるべき所に数値以外があれば bad_config */
export function mergeConfig(raw: unknown): DetectConfig {
  const merge = (base: unknown, over: unknown, path: string): unknown => {
    if (over === undefined) return base
    if (typeof base === 'number') {
      if (typeof over !== 'number' || Number.isNaN(over))
        throw new ToolError('bad_config', `${CONFIG_PATH}: ${path} は数値で指定してください`)
      return over
    }
    if (typeof base === 'object' && base !== null) {
      if (typeof over !== 'object' || over === null)
        throw new ToolError(
          'bad_config',
          `${CONFIG_PATH}: ${path} はオブジェクトで指定してください`,
        )
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(base as object)) {
        out[k] = merge(
          (base as Record<string, unknown>)[k],
          (over as Record<string, unknown>)[k],
          path ? `${path}.${k}` : k,
        )
      }
      return out
    }
    return over
  }
  return merge(DEFAULT_CONFIG, raw ?? {}, '') as DetectConfig
}
