import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot, ToolError, UsageError } from '@trading/cli'
import type { Segment } from '@trading/db/schema'

/** スクリーニングの条件。値が無い項目は条件を満たさないとみなす（Design Doc 0013 §3.5） */
export interface Criteria {
  segments: Segment[]
  sectors: string[]
  perMax?: number
  pbrMax?: number
  dividendMin?: number
  marketCapMin?: number
  growthYears?: number
  roeMin?: number
  operatingMarginMin?: number
  equityRatioMin?: number
  sort: 'dividendYield' | 'per' | 'pbr' | 'marketCap' | 'growthYears'
  limit: number
}

export interface ScreenConfig {
  defaults: Partial<Criteria>
  presets: Record<string, Partial<Criteria>>
}

export const CONFIG_PATH = 'config/screen.json'
const SEGMENTS: Segment[] = ['prime', 'standard', 'growth', 'other']
const SORTS: Criteria['sort'][] = ['dividendYield', 'per', 'pbr', 'marketCap', 'growthYears']

export function loadScreenConfig(root: string = findWorkspaceRoot()): ScreenConfig {
  const path = join(root, CONFIG_PATH)
  if (!existsSync(path)) return { defaults: {}, presets: {} }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ScreenConfig
  } catch (cause) {
    throw new ToolError('bad_config', `${CONFIG_PATH} を JSON として読めません`, {
      details: String(cause),
    })
  }
}

export interface CliOptions {
  preset?: string
  segment?: string
  sector?: string
  perMax?: string
  pbrMax?: string
  dividendMin?: string
  marketCapMin?: string
  growthYears?: string
  roeMin?: string
  operatingMarginMin?: string
  equityRatioMin?: string
  sort?: string
  limit?: string
}

const num = (v: string | undefined, name: string): number | undefined => {
  if (v === undefined) return undefined
  const n = Number(v)
  if (Number.isNaN(n)) throw new UsageError(`${name} は数値: ${v}`)
  return n
}

/** 既定 < プリセット < コマンドラインの順に重ねる */
export function buildCriteria(
  options: CliOptions,
  config: ScreenConfig,
): { criteria: Criteria; preset: string | null } {
  const preset = options.preset ?? null
  if (preset && !config.presets[preset])
    throw new UsageError(`未知の preset: ${preset}`, { known: Object.keys(config.presets) })
  const merged: Partial<Criteria> = {
    ...config.defaults,
    ...(preset ? config.presets[preset] : {}),
  }
  const cli: Partial<Criteria> = {}
  if (options.segment) {
    const segs = options.segment.split(',').map((s) => s.trim()) as Segment[]
    for (const s of segs)
      if (!SEGMENTS.includes(s)) throw new UsageError(`--segment は ${SEGMENTS.join(' | ')}: ${s}`)
    cli.segments = segs
  }
  if (options.sector) cli.sectors = options.sector.split(',').map((s) => s.trim())
  for (const k of [
    'perMax',
    'pbrMax',
    'dividendMin',
    'marketCapMin',
    'growthYears',
    'roeMin',
    'operatingMarginMin',
    'equityRatioMin',
    'limit',
  ] as const) {
    const v = num(options[k], `--${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`)
    if (v !== undefined) cli[k] = v
  }
  if (options.sort) {
    if (!SORTS.includes(options.sort as Criteria['sort']))
      throw new UsageError(`--sort は ${SORTS.join(' | ')}`)
    cli.sort = options.sort as Criteria['sort']
  }
  const c = { ...merged, ...cli }
  const criteria: Criteria = {
    segments: c.segments ?? ['prime', 'standard'],
    sectors: c.sectors ?? [],
    sort: c.sort ?? 'dividendYield',
    limit: c.limit ?? 50,
    ...(c.perMax !== undefined ? { perMax: c.perMax } : {}),
    ...(c.pbrMax !== undefined ? { pbrMax: c.pbrMax } : {}),
    ...(c.dividendMin !== undefined ? { dividendMin: c.dividendMin } : {}),
    ...(c.marketCapMin !== undefined ? { marketCapMin: c.marketCapMin } : {}),
    ...(c.growthYears !== undefined ? { growthYears: c.growthYears } : {}),
    ...(c.roeMin !== undefined ? { roeMin: c.roeMin } : {}),
    ...(c.operatingMarginMin !== undefined ? { operatingMarginMin: c.operatingMarginMin } : {}),
    ...(c.equityRatioMin !== undefined ? { equityRatioMin: c.equityRatioMin } : {}),
  }
  if (!Number.isInteger(criteria.limit) || criteria.limit <= 0)
    throw new UsageError('--limit は正の整数')
  return { criteria, preset }
}
