import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, mergeConfig } from '../src/config.ts'
import {
  belowMa200,
  drawdown60d,
  type PricePoint,
  priceDropCost,
  priceDropDay,
} from '../src/rules.ts'

const day = (i: number) =>
  `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`
/** prices[0] が当日、以降が過去 */
const hist = (prices: number[]): PricePoint[] =>
  prices.map((price, i) => ({ asOf: day(300 - i), price }))

describe('priceDropCost', () => {
  const cfg = DEFAULT_CONFIG.price_drop_cost
  it('-10% で warn、-20% で critical、それ未満は null', () => {
    expect(priceDropCost({ asOf: 'd', price: 950 }, 1000, cfg)).toBeNull()
    expect(priceDropCost({ asOf: 'd', price: 900 }, 1000, cfg)).toMatchObject({
      severity: 'warn',
      value: -10,
    })
    expect(priceDropCost({ asOf: 'd', price: 799 }, 1000, cfg)).toMatchObject({
      severity: 'critical',
      value: -20.1,
    })
  })
  it('取得単価がなければ skipped', () => {
    expect(priceDropCost({ asOf: 'd', price: 1 }, 0, cfg)).toEqual({ skipped: 'no average cost' })
  })
})

describe('drawdown60d', () => {
  const cfg = DEFAULT_CONFIG.drawdown_60d
  it('履歴が minHistory 未満なら skipped', () => {
    expect(drawdown60d(hist(Array(19).fill(100)), cfg)).toMatchObject({
      skipped: expect.stringContaining('19 < 20'),
    })
  })
  it('窓の中の高値からの下落率。窓の外の高値は見ない', () => {
    const prices = [80, ...Array(58).fill(100), 90, 200] // 200 は 61 番目 = 窓の外
    const r = drawdown60d(hist(prices), cfg)
    expect(r).toMatchObject({
      kind: 'drawdown_60d',
      severity: 'warn',
      value: -20,
      details: { high: 100, window: 60 },
    })
  })
  it('-25% で critical', () => {
    expect(drawdown60d(hist([75, ...Array(30).fill(100)]), cfg)).toMatchObject({
      severity: 'critical',
      value: -25,
    })
  })
  it('じわじわ下がるケースを拾う（前日比は毎日 -1.5% 程度）', () => {
    // 12 日かけて毎日 -1.5%。prices[0] が当日（最安 ≒ 84.7）、prices[11] が 100
    const prices: number[] = []
    let p = 100
    for (let i = 0; i < 12; i++) {
      prices.unshift(p)
      p *= 0.985
    }
    const h = hist([...prices, ...Array(20).fill(100)])
    expect(drawdown60d(h, cfg)).toMatchObject({ severity: 'warn' })
    expect(priceDropDay(h, DEFAULT_CONFIG.price_drop_day)).toBeNull()
  })
})

describe('belowMa200', () => {
  const cfg = { window: 5 }
  it('window+1 本ないと skipped', () => {
    expect(belowMa200(hist([1, 1, 1, 1, 1]), cfg)).toMatchObject({
      skipped: expect.stringContaining('5 < 6'),
    })
  })
  it('上から下へ抜けた日だけ鳴る', () => {
    // 過去5日 100、前日 100（MA 100 以上）、当日 90（MA 98 未満）
    expect(belowMa200(hist([90, 100, 100, 100, 100, 100]), cfg)).toMatchObject({
      kind: 'below_ma200',
      severity: 'warn',
    })
    // 前日も既に MA 未満 → 鳴らない
    expect(belowMa200(hist([85, 90, 100, 100, 100, 100, 100]), cfg)).toBeNull()
    // 当日 MA 以上 → 鳴らない
    expect(belowMa200(hist([100, 100, 100, 100, 100, 100]), cfg)).toBeNull()
  })
})

describe('priceDropDay', () => {
  const cfg = DEFAULT_CONFIG.price_drop_day
  it('前日の quote と比べる。-7% で warn', () => {
    expect(priceDropDay(hist([93, 100]), cfg)).toMatchObject({ severity: 'warn', value: -7 })
    expect(priceDropDay(hist([94, 100]), cfg)).toBeNull()
  })
  it('前日の quote がなければ previousClose、それもなければ skipped', () => {
    expect(priceDropDay([{ asOf: 'd', price: 90, previousClose: 100 }], cfg)).toMatchObject({
      value: -10,
      details: { previousAsOf: 'previous_close' },
    })
    expect(priceDropDay([{ asOf: 'd', price: 90 }], cfg)).toEqual({ skipped: 'no previous quote' })
  })
})

describe('mergeConfig', () => {
  it('部分指定は既定値で補う', () => {
    const c = mergeConfig({ price_drop_cost: { warn: -5 }, reissue_after_days: 7 })
    expect(c.price_drop_cost).toEqual({ warn: -5, critical: -20 })
    expect(c.reissue_after_days).toBe(7)
    expect(c.drawdown_60d).toEqual(DEFAULT_CONFIG.drawdown_60d)
  })
  it('数値でなければ bad_config', () => {
    expect(() => mergeConfig({ price_drop_day: { warn: '-7' } })).toThrow(
      expect.objectContaining({ code: 'bad_config' }),
    )
  })
})
