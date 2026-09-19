import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot, ToolError } from '@trading/cli'

/** 閾値。config/detect.json で上書きできる（Design Doc 0005 §3.1） */
export interface DetectConfig {
  price_drop_cost: { warn: number; critical: number }
  drawdown_60d: { warn: number; critical: number; window: number; minHistory: number }
  below_ma200: { window: number }
  price_drop_day: { warn: number }
  reissue_after_days: number
}

export const DEFAULT_CONFIG: DetectConfig = {
  price_drop_cost: { warn: -10, critical: -20 },
  drawdown_60d: { warn: -15, critical: -25, window: 60, minHistory: 20 },
  below_ma200: { window: 200 },
  price_drop_day: { warn: -7 },
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

export function mergeConfig(raw: unknown): DetectConfig {
  const r = (raw ?? {}) as Record<string, Record<string, unknown> | number>
  const num = (section: string, key: string, fallback: number): number => {
    const s = r[section]
    const v = typeof s === 'object' && s !== null ? s[key] : undefined
    if (v === undefined) return fallback
    if (typeof v !== 'number' || Number.isNaN(v)) {
      throw new ToolError(
        'bad_config',
        `${CONFIG_PATH}: ${section}.${key} は数値で指定してください`,
      )
    }
    return v
  }
  const top = (key: keyof DetectConfig, fallback: number): number => {
    const v = r[key]
    if (v === undefined) return fallback
    if (typeof v !== 'number')
      throw new ToolError('bad_config', `${CONFIG_PATH}: ${key} は数値で指定してください`)
    return v
  }
  const d = DEFAULT_CONFIG
  return {
    price_drop_cost: {
      warn: num('price_drop_cost', 'warn', d.price_drop_cost.warn),
      critical: num('price_drop_cost', 'critical', d.price_drop_cost.critical),
    },
    drawdown_60d: {
      warn: num('drawdown_60d', 'warn', d.drawdown_60d.warn),
      critical: num('drawdown_60d', 'critical', d.drawdown_60d.critical),
      window: num('drawdown_60d', 'window', d.drawdown_60d.window),
      minHistory: num('drawdown_60d', 'minHistory', d.drawdown_60d.minHistory),
    },
    below_ma200: { window: num('below_ma200', 'window', d.below_ma200.window) },
    price_drop_day: { warn: num('price_drop_day', 'warn', d.price_drop_day.warn) },
    reissue_after_days: top('reissue_after_days', d.reissue_after_days),
  }
}
