import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, mergeConfig } from '../src/config.ts'
import {
  type AnnualPeriod,
  type DatedAssessment,
  dividendCut,
  equityRatioDrop,
  forecastDown,
  marginDeterioration,
  newsNegative,
} from '../src/rules/index.ts'
import { computeScore, scoreLow } from '../src/score.ts'

const base = {
  id: 1,
  instrumentId: 'JP:1234',
  relevance: 'relevant',
  direction: null,
  summary: 's',
  rationale: 'r',
  author: 'ai',
  model: null,
  note: null,
  createdAt: 'x',
  subjectTitle: 't',
} as const
const a = (over: Partial<DatedAssessment>): DatedAssessment =>
  ({
    ...base,
    subjectType: 'news',
    subjectId: 1,
    sentiment: 0,
    impact: 1,
    subjectAt: '2026-01-05T09:00:00+09:00',
    ...over,
  }) as DatedAssessment

describe('newsNegative', () => {
  const cfg = DEFAULT_CONFIG.news_negative
  it('7 日以内・relevant・sentiment ≤ -1・impact ≥ 2 で鳴り、最も悪いものが代表', () => {
    const list = [
      a({ subjectId: 1, sentiment: -1, impact: 2, subjectTitle: 'mild' }),
      a({ subjectId: 2, sentiment: -2, impact: 3, subjectTitle: 'worst' }),
      a({ subjectId: 3, sentiment: -2, impact: 3, relevance: 'irrelevant' }),
      a({ subjectId: 4, sentiment: -2, impact: 3, subjectAt: '2025-12-01T09:00:00+09:00' }), // 古い
      a({ subjectId: 5, sentiment: -2, impact: 1 }), // impact 不足
      a({ subjectId: 6, sentiment: -2, impact: 3, subjectType: 'disclosure' }), // ニュースではない
    ]
    const r = newsNegative(list, '2026-01-06', cfg)
    expect(r).toMatchObject({
      kind: 'news_negative',
      severity: 'critical',
      value: -6,
      details: { subjectId: 2, title: 'worst', count: 2 },
    })
    expect(newsNegative([a({ sentiment: -1, impact: 2 })], '2026-01-06', cfg)).toMatchObject({
      severity: 'warn',
    })
    expect(newsNegative([a({ sentiment: 0, impact: 3 })], '2026-01-06', cfg)).toBeNull()
  })
})

describe('forecastDown / dividendCut', () => {
  it('開示の種別と direction = down で鳴る。30 日より古いものは無視', () => {
    const list = [
      a({
        subjectId: 10,
        subjectType: 'disclosure',
        subjectCategory: 'forecast_revision',
        direction: 'down',
        sentiment: -2,
        impact: 3,
        subjectAt: '2026-01-04T15:00:00+09:00',
      }),
      a({
        subjectId: 11,
        subjectType: 'disclosure',
        subjectCategory: 'forecast_revision',
        direction: 'up',
        sentiment: 2,
        impact: 3,
      }),
      a({
        subjectId: 12,
        subjectType: 'disclosure',
        subjectCategory: 'dividend',
        direction: 'down',
        sentiment: -2,
        impact: 3,
        subjectAt: '2025-11-01T15:00:00+09:00',
      }),
    ]
    expect(forecastDown(list, '2026-01-06', DEFAULT_CONFIG.forecast_down)).toMatchObject({
      kind: 'forecast_down',
      severity: 'critical',
      details: { subjectId: 10 },
    })
    expect(dividendCut(list, '2026-01-06', DEFAULT_CONFIG.dividend_cut)).toBeNull()
    expect(dividendCut(list, '2025-11-05', DEFAULT_CONFIG.dividend_cut)).toMatchObject({
      kind: 'dividend_cut',
    })
  })
})

const annual: AnnualPeriod[] = [
  { periodEnd: '2026-03-31', revenue: 1000, operatingIncome: 50, totalAssets: 2000, equity: 700 }, // 利益率 5%、自己資本比率 35%
  { periodEnd: '2025-03-31', revenue: 900, operatingIncome: 81, totalAssets: 1800, equity: 810 }, // 9%、45%
  { periodEnd: '2024-03-31', revenue: 800, operatingIncome: 80, totalAssets: 1600, equity: 800 },
]

describe('marginDeterioration / equityRatioDrop', () => {
  it('直近 2 期の差（pt）で判定し、データ不足は skipped', () => {
    expect(marginDeterioration(annual, DEFAULT_CONFIG.margin_deterioration)).toMatchObject({
      kind: 'margin_deterioration',
      severity: 'warn',
      value: -4,
      details: { currentMargin: 5, previousMargin: 9 },
    })
    expect(equityRatioDrop(annual, DEFAULT_CONFIG.equity_ratio_drop)).toMatchObject({
      kind: 'equity_ratio_drop',
      severity: 'critical',
      value: -10,
    })
    expect(
      marginDeterioration([annual[0] as AnnualPeriod], DEFAULT_CONFIG.margin_deterioration),
    ).toMatchObject({ skipped: expect.stringContaining('1 < 2') })
    // 営業利益が無い期は飛ばして次の期と比べる
    const gap: AnnualPeriod[] = [
      annual[0] as AnnualPeriod,
      {
        periodEnd: '2025-03-31',
        revenue: 900,
        operatingIncome: null,
        totalAssets: null,
        equity: null,
      },
      annual[2] as AnnualPeriod,
    ]
    expect(marginDeterioration(gap, DEFAULT_CONFIG.margin_deterioration)).toMatchObject({
      value: -5,
      details: { previousPeriod: '2024-03-31' },
    })
  })
})

describe('computeScore', () => {
  const day = (i: number) =>
    `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`
  const flat = (n: number, price: number) =>
    Array.from({ length: n }, (_, i) => ({ asOf: day(300 - i), price }))
  it('判定・株価・財務の成分を足し、内訳と注記を返す', () => {
    // 判定: 当日の -2×3 = -6 × 5 = -30、14 日前の +2×3 = +6 × 0.5 × 5 = +15 → -15
    const assessments = [
      a({ subjectId: 1, sentiment: -2, impact: 3, subjectAt: '2026-01-10T09:00:00+09:00' }),
      a({ subjectId: 2, sentiment: 2, impact: 3, subjectAt: '2025-12-27T09:00:00+09:00' }),
      a({
        subjectId: 3,
        sentiment: -2,
        impact: 3,
        relevance: 'irrelevant',
        subjectAt: '2026-01-10T09:00:00+09:00',
      }),
    ]
    // 株価: 高値 100 から 80（-20% × 0.5 = -10）、履歴は 30 本（200 日線は評価しない）
    const history = [{ asOf: '2026-01-10', price: 80 }, ...flat(29, 100)]
    const r = computeScore({ asOf: '2026-01-10', history, assessments, annual }, DEFAULT_CONFIG)
    expect(r.components.assessment).toBeCloseTo(-15, 5)
    expect(r.components.price).toBe(-10)
    // 財務: -4×2 + -10×1 = -18
    expect(r.components.financials).toBe(-18)
    expect(r.score).toBeCloseTo(-43, 5)
    expect(r.components.notes).toEqual([])
  })
  it('データが無いときは注記し、成分は 0', () => {
    const r = computeScore(
      {
        asOf: '2026-01-10',
        history: [{ asOf: '2026-01-10', price: 1 }],
        assessments: [],
        annual: [],
      },
      DEFAULT_CONFIG,
    )
    expect(r).toEqual({
      score: 0,
      components: {
        assessment: 0,
        price: 0,
        financials: 0,
        notes: ['判定なし', '株価履歴が不足', '年次財務なし'],
      },
    })
  })
  it('200 日線より下なら penalty、上下限で clamp', () => {
    const history = [{ asOf: '2026-01-10', price: 50 }, ...flat(200, 100)]
    const r = computeScore(
      { asOf: '2026-01-10', history, assessments: [], annual: [] },
      DEFAULT_CONFIG,
    )
    // 高値 100 から -50% × 0.5 = -25、200 日線より下 -10 → -35
    expect(r.components.price).toBe(-35)
    const many = Array.from({ length: 10 }, (_, i) =>
      a({ subjectId: i, sentiment: -2, impact: 3, subjectAt: '2026-01-10T09:00:00+09:00' }),
    )
    expect(
      computeScore({ asOf: '2026-01-10', history, assessments: many, annual: [] }, DEFAULT_CONFIG)
        .components.assessment,
    ).toBe(-50)
  })
  it('scoreLow', () => {
    expect(scoreLow(-39, DEFAULT_CONFIG.score_low)).toBeNull()
    expect(scoreLow(-40, DEFAULT_CONFIG.score_low)).toMatchObject({ severity: 'warn' })
    expect(scoreLow(-60, DEFAULT_CONFIG.score_low)).toMatchObject({ severity: 'critical' })
  })
})

describe('mergeConfig (nested)', () => {
  it('入れ子の部分指定と型の検証', () => {
    const c = mergeConfig({ score: { assessment: { cap: 30 } }, news_negative: { windowDays: 3 } })
    expect(c.score.assessment).toEqual({ ...DEFAULT_CONFIG.score.assessment, cap: 30 })
    expect(c.score.price).toEqual(DEFAULT_CONFIG.score.price)
    expect(c.news_negative.windowDays).toBe(3)
    expect(() => mergeConfig({ score: { price: { floor: 'x' } } })).toThrow(
      expect.objectContaining({ code: 'bad_config' }),
    )
    expect(() => mergeConfig({ score: 5 })).toThrow(expect.objectContaining({ code: 'bad_config' }))
  })
})
