import { nowJst } from '@trading/cli'
import { schema, type TradingDatabase } from '@trading/db'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { parse, stringify } from 'yaml'
import { type ActionView, listActions } from './actions.ts'
import { effectiveAssessments } from './assessments.ts'
import { financialHistory, latestFundamentals } from './market-data.ts'
import { monitoredInstruments } from './monitored.ts'
import { quoteHistory } from './quotes.ts'
import { latestScores, scoreHistory } from './scores.ts'

/** 助言（Design Doc 0012）。actions に origin = 'ai' で保存し、本文の front matter に stance と references を持つ */

/** 保有: hold / review / reduce、ウォッチ: candidate / review / pass（Design Doc 0013 §3.6） */
export const STANCES = ['hold', 'review', 'reduce', 'candidate', 'pass'] as const
export type Stance = (typeof STANCES)[number]
export const HOLDING_STANCES: readonly Stance[] = ['hold', 'review', 'reduce']
export const WATCH_STANCES: readonly Stance[] = ['candidate', 'review', 'pass']

export interface AdviceReference {
  type: 'news' | 'disclosure' | 'signal' | 'financials' | 'quote' | 'score' | 'action'
  id?: number
  label: string
  url?: string
}

export interface Advice {
  actionId: number
  ruleActionId: number
  signalId: number | null
  stance: Stance
  title: string
  markdown: string
  references: AdviceReference[]
  model: string | null
  createdAt: string
}

export function renderAdviceBody(
  stance: Stance,
  references: AdviceReference[],
  markdown: string,
  model?: string,
): string {
  return `---\n${stringify({ stance, references, ...(model ? { model } : {}) }).trim()}\n---\n${markdown.trim()}\n`
}

export function parseAdviceBody(body: string): {
  stance: Stance
  references: AdviceReference[]
  markdown: string
  model: string | null
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(body)
  if (!m) return { stance: 'review', references: [], markdown: body, model: null }
  const fm = (parse(m[1] as string) ?? {}) as {
    stance?: Stance
    references?: AdviceReference[]
    model?: string
  }
  return {
    stance: STANCES.includes(fm.stance as Stance) ? (fm.stance as Stance) : 'review',
    references: Array.isArray(fm.references) ? fm.references : [],
    markdown: (m[2] as string).trim(),
    model: fm.model ?? null,
  }
}

const daysAgo = (asOf: string, days: number) => {
  const d = new Date(`${asOf}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** 助言のための事実の束（0012 §3.2）。エージェントはこれ以外を材料にしない */
export function factBundle(db: TradingDatabase, action: ActionView) {
  const id = action.instrumentId
  const monitored = monitoredInstruments(db).find((m) => m.instrumentId === id) ?? null
  const position = monitored?.position ?? null
  const context: 'holding' | 'watch' = position ? 'holding' : 'watch'
  const quotes = quoteHistory(db, id, { limit: 200 })
  const latest = quotes[0]
  const window60 = quotes.slice(0, 60)
  const high60 = window60.length > 0 ? Math.max(...window60.map((q) => q.price)) : null
  const ma200 = quotes.length >= 200 ? quotes.reduce((s, q) => s + q.price, 0) / 200 : null
  const asOf = latest?.asOf ?? nowJst().slice(0, 10)
  const since = daysAgo(asOf, 30)
  const score = latestScores(db).get(id) ?? null
  const signals = db
    .select()
    .from(schema.signals)
    .where(and(eq(schema.signals.instrumentId, id), gte(schema.signals.asOf, since)))
    .orderBy(desc(schema.signals.asOf))
    .all()
  const assessments = effectiveAssessments(db, { instrumentId: id }).filter(
    (a) => a.relevance === 'relevant',
  )
  const newsIds = assessments.filter((a) => a.subjectType === 'news').map((a) => a.subjectId)
  const discIds = assessments.filter((a) => a.subjectType === 'disclosure').map((a) => a.subjectId)
  const news = new Map(
    (newsIds.length
      ? db.select().from(schema.newsItems).where(inArray(schema.newsItems.id, newsIds)).all()
      : []
    ).map((n) => [n.id, n]),
  )
  const disc = new Map(
    (discIds.length
      ? db.select().from(schema.disclosures).where(inArray(schema.disclosures.id, discIds)).all()
      : []
    ).map((d) => [d.id, d]),
  )
  const annual = financialHistory(db, id, 'annual').slice(0, 3)
  const pct = (a: number, b: number | null) =>
    b && b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : null
  return {
    context,
    stances: context === 'holding' ? HOLDING_STANCES : WATCH_STANCES,
    action: {
      id: action.id,
      kind: action.kind,
      severity: action.severity,
      title: action.title,
      body: action.body,
      createdAt: action.createdAt,
    },
    instrument: {
      id,
      code: action.code,
      name: action.name,
      watch: monitored?.watch ?? null,
      position: position
        ? {
            quantity: position.quantity,
            averageCost: Math.round(position.averageCost * 100) / 100,
            accounts: position.accounts.map((a) => ({
              account: a.account,
              quantity: a.quantity,
              averageCost: a.averageCost,
            })),
            marketValue: latest
              ? Math.round(latest.price * position.quantity)
              : position.marketValue,
            unrealizedPnl: latest
              ? Math.round((latest.price - position.averageCost) * position.quantity)
              : position.unrealizedPnl,
          }
        : null,
    },
    quotes: {
      asOf,
      price: latest?.price ?? null,
      recent: quotes.slice(0, 30).map((q) => ({ asOf: q.asOf, price: q.price })),
      high60,
      drawdownFromHigh60: latest && high60 ? pct(latest.price, high60) : null,
      ma200: ma200 == null ? null : Math.round(ma200 * 100) / 100,
      vsMa200: latest && ma200 ? pct(latest.price, ma200) : null,
      vsAverageCost: latest && position ? pct(latest.price, position.averageCost) : null,
    },
    score: score
      ? {
          asOf: score.asOf,
          score: score.score,
          components: score.components,
          history: scoreHistory(db, id, 30)
            .filter((_, i) => i % 5 === 0)
            .map((s) => ({ asOf: s.asOf, score: s.score })),
        }
      : null,
    signals: signals.map((s) => ({
      id: s.id,
      kind: s.kind,
      severity: s.severity,
      value: s.value,
      asOf: s.asOf,
    })),
    assessments: assessments
      .filter((a) => {
        const at =
          a.subjectType === 'news'
            ? news.get(a.subjectId)?.publishedAt
            : disc.get(a.subjectId)?.disclosedAt
        return at !== undefined && at.slice(0, 10) >= since
      })
      .map((a) => {
        const n = a.subjectType === 'news' ? news.get(a.subjectId) : undefined
        const d = a.subjectType === 'disclosure' ? disc.get(a.subjectId) : undefined
        return {
          id: a.id,
          subjectType: a.subjectType,
          subjectId: a.subjectId,
          at: n?.publishedAt ?? d?.disclosedAt ?? null,
          title: n?.title ?? d?.title ?? null,
          url: n?.url ?? d?.pdfUrl ?? null,
          category: d?.category ?? null,
          sentiment: a.sentiment,
          impact: a.impact,
          direction: a.direction,
          summary: a.summary,
          rationale: a.rationale,
          author: a.author,
        }
      }),
    financials: annual.map((f) => ({
      periodEnd: f.periodEnd,
      revenue: f.revenue,
      operatingIncome: f.operatingIncome,
      operatingMargin:
        f.revenue && f.operatingIncome != null && f.revenue > 0
          ? Math.round((f.operatingIncome / f.revenue) * 10000) / 100
          : null,
      equityRatio:
        f.totalAssets && f.equity != null && f.totalAssets > 0
          ? Math.round((f.equity / f.totalAssets) * 10000) / 100
          : null,
    })),
    fundamentals: (() => {
      const f = latestFundamentals(db, id)
      return f
        ? {
            asOf: f.asOf,
            per: f.per,
            forwardPer: f.forwardPer,
            pbr: f.pbr,
            dividendYield: f.dividendYield,
            roe: f.roe,
            nextEarningsDate: f.nextEarningsDate,
          }
        : null
    })(),
    history: listActions(db, { instrumentId: id })
      .filter((a) => a.id !== action.id && a.origin === 'rule')
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        note: a.note,
        createdAt: a.createdAt,
        resolvedAt: a.resolvedAt,
      })),
  }
}

export type FactBundle = ReturnType<typeof factBundle>

/** 助言が無い未対応のルール生成アクション */
export function pendingAdvice(
  db: TradingDatabase,
  limit = 20,
): { items: FactBundle[]; remaining: number } {
  const open = listActions(db, { status: 'open' }).filter(
    (a) => a.origin === 'rule' && a.signalId != null,
  )
  const advised = new Set(
    db
      .select({ signalId: schema.actions.signalId })
      .from(schema.actions)
      .where(eq(schema.actions.origin, 'ai'))
      .all()
      .map((a) => a.signalId),
  )
  const targets = open.filter((a) => !advised.has(a.signalId))
  return {
    items: targets.slice(0, limit).map((a) => factBundle(db, a)),
    remaining: Math.max(0, targets.length - limit),
  }
}

export interface AdviceInput {
  actionId: number
  stance: Stance
  title: string
  body: string
  references: AdviceReference[]
  model?: string
}

export function validateAdviceInput(
  raw: unknown,
  index: number,
): { ok: true; value: AdviceInput } | { ok: false; error: string } {
  const r = raw as Record<string, unknown>
  const err = (m: string) => ({ ok: false as const, error: `[${index}] ${m}` })
  if (typeof r !== 'object' || r === null) return err('オブジェクトではありません')
  if (!Number.isInteger(r.actionId) || (r.actionId as number) <= 0)
    return err('actionId は正の整数')
  if (!STANCES.includes(r.stance as Stance)) return err(`stance は ${STANCES.join(' | ')}`)
  if (typeof r.title !== 'string' || r.title.trim() === '') return err('title は空でない文字列')
  if (typeof r.body !== 'string' || r.body.trim() === '') return err('body は空でない文字列')
  if (!Array.isArray(r.references) || r.references.length === 0)
    return err('references は 1 件以上（参照した事実が無い助言は受け付けない）')
  for (const ref of r.references as Record<string, unknown>[]) {
    if (
      typeof ref !== 'object' ||
      ref === null ||
      typeof ref.type !== 'string' ||
      typeof ref.label !== 'string'
    )
      return err('references の各要素は { type, label, id?, url? }')
  }
  const value: AdviceInput = {
    actionId: r.actionId as number,
    stance: r.stance as Stance,
    title: (r.title as string).trim(),
    body: (r.body as string).trim(),
    references: r.references as AdviceReference[],
  }
  if (typeof r.model === 'string') value.model = r.model
  return { ok: true, value }
}

export class AdviceError extends Error {
  constructor(
    readonly code: 'not_found' | 'not_open' | 'already_advised' | 'no_signal' | 'bad_stance',
    message: string,
  ) {
    super(message)
    this.name = 'AdviceError'
  }
}

/** 助言を書き込む。1 件でも問題があれば全体を失敗にする */
export function recordAdvice(
  db: TradingDatabase,
  inputs: AdviceInput[],
): { written: number; ids: number[] } {
  const now = nowJst()
  const ids: number[] = []
  db.transaction((tx) => {
    for (const a of inputs) {
      const rule = tx.select().from(schema.actions).where(eq(schema.actions.id, a.actionId)).get()
      if (!rule) throw new AdviceError('not_found', `アクション ${a.actionId} はありません`)
      if (rule.status !== 'open')
        throw new AdviceError('not_open', `アクション ${a.actionId} は ${rule.status} です`)
      if (rule.signalId == null)
        throw new AdviceError('no_signal', `アクション ${a.actionId} はシグナル由来ではありません`)
      const dup = tx
        .select({ id: schema.actions.id })
        .from(schema.actions)
        .where(and(eq(schema.actions.signalId, rule.signalId), eq(schema.actions.origin, 'ai')))
        .get()
      if (dup)
        throw new AdviceError(
          'already_advised',
          `アクション ${a.actionId} には既に助言があります（id=${dup.id}）`,
        )
      const isHolding = monitoredInstruments(tx as unknown as TradingDatabase).some(
        (m) => m.instrumentId === rule.instrumentId && m.position !== null,
      )
      const allowed = isHolding ? HOLDING_STANCES : WATCH_STANCES
      if (!allowed.includes(a.stance))
        throw new AdviceError(
          'bad_stance',
          `アクション ${a.actionId}（${isHolding ? '保有' : 'ウォッチ'}）の stance は ${allowed.join(' | ')}`,
        )
      const row = tx
        .insert(schema.actions)
        .values({
          instrumentId: rule.instrumentId,
          signalId: rule.signalId,
          origin: 'ai',
          title: a.title,
          body: renderAdviceBody(a.stance, a.references, a.body, a.model),
          status: rule.status,
          createdAt: now,
        })
        .returning({ id: schema.actions.id })
        .get()
      if (row) ids.push(row.id)
    }
  })
  return { written: ids.length, ids }
}

/** ルール生成のアクション id → 助言 */
export function adviceForActions(
  db: TradingDatabase,
  actions: { id: number; signalId: number | null }[],
): Map<number, Advice> {
  const signalIds = actions.map((a) => a.signalId).filter((s): s is number => s != null)
  if (signalIds.length === 0) return new Map()
  const rows = db
    .select()
    .from(schema.actions)
    .where(and(eq(schema.actions.origin, 'ai'), inArray(schema.actions.signalId, signalIds)))
    .all()
  const bySignal = new Map(rows.map((r) => [r.signalId, r]))
  const out = new Map<number, Advice>()
  for (const a of actions) {
    const r = a.signalId == null ? undefined : bySignal.get(a.signalId)
    if (!r) continue
    const parsed = parseAdviceBody(r.body)
    out.set(a.id, {
      actionId: r.id,
      ruleActionId: a.id,
      signalId: r.signalId,
      stance: parsed.stance,
      title: r.title,
      markdown: parsed.markdown,
      references: parsed.references,
      model: parsed.model,
      createdAt: r.createdAt,
    })
  }
  return out
}
