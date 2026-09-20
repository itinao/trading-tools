import { isIsoDate, nowJst, type ToolContext, ToolError, UsageError } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import {
  effectiveAssessments,
  financialHistory,
  latestFundamentals,
  latestQuoteDate,
  type MonitoredInstrument,
  monitoredInstruments,
  quoteHistory,
  upsertScore,
} from '@trading/domain'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { actionText } from './actions-text.ts'
import type { DetectConfig } from './config.ts'
import {
  type DatedAssessment,
  dividendCut,
  equityRatioDrop,
  evaluatePriceRules,
  forecastDown,
  growthStreak,
  marginDeterioration,
  newsNegative,
  OFFENSE_KINDS,
  oversoldQuality,
  type RuleHit,
  type RuleOutcome,
  SIGNAL_KINDS,
  type SignalKind,
  valuationCheap,
} from './rules/index.ts'
import { computeScore, scoreLow } from './score.ts'

export interface RunResult {
  asOf: string
  evaluated: number
  skipped: { code: string; kind: SignalKind | 'all'; reason: string }[]
  signals: { created: number; updated: number }
  actions: { created: number; suppressed: number }
  scores: { written: number }
}

/** 有効な判定に対象の日時・表題・開示の種別を付ける（news_negative 等とスコアの入力） */
export function datedAssessments(
  handle: DatabaseHandle,
  instrumentIds: string[],
): Map<string, DatedAssessment[]> {
  const out = new Map<string, DatedAssessment[]>()
  if (instrumentIds.length === 0) return out
  const all = effectiveAssessments(handle.db, { instrumentIds })
  const newsIds = all.filter((a) => a.subjectType === 'news').map((a) => a.subjectId)
  const discIds = all.filter((a) => a.subjectType === 'disclosure').map((a) => a.subjectId)
  const news = new Map(
    (newsIds.length > 0
      ? handle.db.select().from(schema.newsItems).where(inArray(schema.newsItems.id, newsIds)).all()
      : []
    ).map((n) => [n.id, n]),
  )
  const disc = new Map(
    (discIds.length > 0
      ? handle.db
          .select()
          .from(schema.disclosures)
          .where(inArray(schema.disclosures.id, discIds))
          .all()
      : []
    ).map((d) => [d.id, d]),
  )
  for (const a of all) {
    let dated: DatedAssessment | undefined
    if (a.subjectType === 'news') {
      const n = news.get(a.subjectId)
      if (n) dated = { ...a, subjectAt: n.publishedAt, subjectTitle: n.title }
    } else {
      const d = disc.get(a.subjectId)
      if (d)
        dated = {
          ...a,
          subjectAt: d.disclosedAt,
          subjectTitle: d.title,
          subjectCategory: d.category,
        }
    }
    if (!dated) continue
    const list = out.get(a.instrumentId) ?? []
    list.push(dated)
    out.set(a.instrumentId, list)
  }
  return out
}

const SEVERITY_RANK = { warn: 1, critical: 2 } as const

export function runDetect(
  handle: DatabaseHandle,
  context: ToolContext,
  options: { asOf?: string },
  config: DetectConfig,
): RunResult {
  const { db } = handle
  // 既定は株価の最新日（休日に実行しても直近の営業日を評価する。Design Doc 0010 §3.4）
  const asOf = options.asOf ?? latestQuoteDate(db)
  if (asOf === undefined)
    throw new ToolError('no_quotes', '株価がありません。先に collect quotes を実行してください')
  if (!isIsoDate(asOf)) throw new UsageError(`--as-of は YYYY-MM-DD: ${asOf}`)
  const result: RunResult = {
    asOf,
    evaluated: 0,
    skipped: [],
    signals: { created: 0, updated: 0 },
    actions: { created: 0, suppressed: 0 },
    scores: { written: 0 },
  }
  const now = nowJst()

  const write = (fn: () => void) => {
    if (!context.options.dryRun) fn()
  }

  // 監視対象 = 保有 ∪ ウォッチ（Design Doc 0013）。攻めのルールはウォッチにだけ適用する
  const monitored = monitoredInstruments(db)
  const assessmentsByInstrument = datedAssessments(
    handle,
    monitored.map((m) => m.instrumentId),
  )

  for (const position of monitored) {
    const history = quoteHistory(db, position.instrumentId, {
      upTo: asOf,
      limit: config.below_ma200.window + 1,
    })
    if (history[0]?.asOf !== asOf) {
      result.skipped.push({ code: position.code, kind: 'all', reason: `no quote for ${asOf}` })
      continue
    }
    result.evaluated++
    const assessments = assessmentsByInstrument.get(position.instrumentId) ?? []
    const annual = financialHistory(db, position.instrumentId, 'annual')

    // スコア（Design Doc 0011 §3.4）。シグナルの前に計算し、score_low の入力にする
    const { score, components } = computeScore({ asOf, history, assessments, annual }, config)
    write(() => upsertScore(db, position.instrumentId, asOf, score, components))
    result.scores.written++
    const scoreHit = scoreLow(score, config.score_low)
    if (scoreHit && !('skipped' in scoreHit)) {
      scoreHit.details = {
        ...scoreHit.details,
        assessment: components.assessment,
        price: components.price,
        financials: components.financials,
      }
    }

    const isWatch = position.position === null
    const f = latestFundamentals(db, position.instrumentId)
    const cheap = isWatch
      ? valuationCheap(
          f ? { per: f.per, pbr: f.pbr, dividendYield: f.dividendYield, asOf: f.asOf } : null,
          config.valuation_cheap,
        )
      : null
    const growth = isWatch ? growthStreak(annual, config.growth_streak) : null
    const outcomes: Record<SignalKind, RuleOutcome> = {
      ...evaluatePriceRules(history, position.position?.averageCost ?? 0, config),
      news_negative: newsNegative(assessments, asOf, config.news_negative),
      forecast_down: forecastDown(assessments, asOf, config.forecast_down),
      dividend_cut: dividendCut(assessments, asOf, config.dividend_cut),
      margin_deterioration: marginDeterioration(annual, config.margin_deterioration),
      equity_ratio_drop: equityRatioDrop(annual, config.equity_ratio_drop),
      score_low: scoreHit,
      valuation_cheap: cheap,
      growth_streak: growth,
      oversold_quality: isWatch
        ? oversoldQuality(history, cheap, growth, config.oversold_quality, {
            ma: config.below_ma200.window,
            drawdown: config.drawdown_60d.window,
          })
        : null,
    }
    for (const kind of SIGNAL_KINDS) {
      if (!isWatch && OFFENSE_KINDS.includes(kind)) continue
      const outcome = outcomes[kind]
      if (outcome === null) continue
      if ('skipped' in outcome) {
        result.skipped.push({ code: position.code, kind, reason: outcome.skipped })
        continue
      }
      context.logger.info(`${position.code} ${kind} ${outcome.severity} ${outcome.value}`)
      db.transaction((tx) => {
        const signalId = upsertSignal(tx, position.instrumentId, asOf, outcome, now, result, write)
        createActionIfNeeded(tx, position, asOf, signalId, outcome, config, now, result, write)
      })
    }
  }
  return result
}

type Tx = Parameters<Parameters<DatabaseHandle['db']['transaction']>[0]>[0]

function upsertSignal(
  tx: Tx,
  instrumentId: string,
  asOf: string,
  hit: RuleHit,
  now: string,
  result: RunResult,
  write: (fn: () => void) => void,
): number | undefined {
  const existing = tx
    .select({ id: schema.signals.id })
    .from(schema.signals)
    .where(
      and(
        eq(schema.signals.instrumentId, instrumentId),
        eq(schema.signals.kind, hit.kind),
        eq(schema.signals.asOf, asOf),
      ),
    )
    .get()
  const values = {
    severity: hit.severity,
    value: hit.value,
    detailsJson: JSON.stringify(hit.details),
    updatedAt: now,
  }
  if (existing) {
    result.signals.updated++
    write(() =>
      tx.update(schema.signals).set(values).where(eq(schema.signals.id, existing.id)).run(),
    )
    return existing.id
  }
  result.signals.created++
  let id: number | undefined
  write(() => {
    id = tx
      .insert(schema.signals)
      .values({ instrumentId, kind: hit.kind, asOf, createdAt: now, ...values })
      .returning({ id: schema.signals.id })
      .get()?.id
  })
  return id
}

/** Design Doc 0005 §3.1「アクションの生成（重複の抑制）」 */
function createActionIfNeeded(
  tx: Tx,
  position: MonitoredInstrument,
  asOf: string,
  signalId: number | undefined,
  hit: RuleHit,
  config: DetectConfig,
  now: string,
  result: RunResult,
  write: (fn: () => void) => void,
): void {
  // このシグナルに既にルール生成のアクションがある（同日の再実行）
  if (signalId !== undefined) {
    const dup = tx
      .select({ id: schema.actions.id })
      .from(schema.actions)
      .where(and(eq(schema.actions.signalId, signalId), eq(schema.actions.origin, 'rule')))
      .get()
    if (dup) {
      result.actions.suppressed++
      return
    }
  }
  // 同じ銘柄・同じ kind の直近のルール生成アクション
  const last = tx
    .select({
      status: schema.actions.status,
      createdAt: schema.actions.createdAt,
      severity: schema.signals.severity,
    })
    .from(schema.actions)
    .innerJoin(schema.signals, eq(schema.actions.signalId, schema.signals.id))
    .where(
      and(
        eq(schema.actions.instrumentId, position.instrumentId),
        eq(schema.signals.kind, hit.kind),
        eq(schema.actions.origin, 'rule'),
      ),
    )
    .orderBy(desc(schema.actions.createdAt), desc(schema.actions.id))
    .get()
  if (last) {
    if (last.status === 'open') {
      result.actions.suppressed++
      return
    }
    const escalated =
      SEVERITY_RANK[hit.severity] >
      (SEVERITY_RANK[last.severity as keyof typeof SEVERITY_RANK] ?? 0)
    const ageDays = (Date.parse(now) - Date.parse(last.createdAt)) / 86_400_000
    if (!escalated && ageDays < config.reissue_after_days) {
      result.actions.suppressed++
      return
    }
  }
  result.actions.created++
  const text = actionText(hit, position, asOf)
  write(() =>
    tx
      .insert(schema.actions)
      .values({
        instrumentId: position.instrumentId,
        signalId: signalId ?? null,
        origin: 'rule',
        title: text.title,
        body: text.body,
        status: 'open',
        createdAt: now,
      })
      .run(),
  )
}
