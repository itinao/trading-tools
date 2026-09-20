import { schema, type TradingDatabase } from '@trading/db'
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm'
import { parseAdviceBody, type Stance } from './advice.ts'
import { effectiveAssessments } from './assessments.ts'
import { positions } from './holdings.ts'
import { latestQuotes, quoteHistory } from './quotes.ts'
import { scoreHistory } from './scores.ts'

/** 振り返り（Design Doc 0014）。既存のデータを時系列に並べ直す。テーブルは増やさない */

export type TimelineEventType = 'signal' | 'action' | 'advice' | 'assessment' | 'score' | 'holding'

export interface TimelineEvent {
  at: string
  type: TimelineEventType
  title: string
  detail: string | null
  /** その日の株価（無ければ直近） */
  priceAt: number | null
  /** 今の株価との差（%）。priceAt が無ければ null */
  changeSince: number | null
  /** 画面のリンク・バッジ用 */
  meta: Record<string, string | number | null>
}

const pct = (a: number, b: number | null) =>
  b && b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : null
const dateOf = (iso: string) => iso.slice(0, 10)
const daysAgo = (from: string, days: number) => {
  const d = new Date(`${from}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** 日付 → その日以前の直近の株価 */
function priceLookup(quotes: { asOf: string; price: number }[]): (date: string) => number | null {
  const sorted = [...quotes].sort((a, b) => a.asOf.localeCompare(b.asOf))
  return (date) => {
    let found: number | null = null
    for (const q of sorted) {
      if (q.asOf <= date) found = q.price
      else break
    }
    return found
  }
}

export function timeline(
  db: TradingDatabase,
  instrumentId: string,
  options: { days?: number | null } = {},
): { events: TimelineEvent[]; latestPrice: number | null; latestAsOf: string | null } {
  const quotes = quoteHistory(db, instrumentId, { limit: 400 })
  const latest = quotes[0] ?? null
  const since =
    options.days == null
      ? null
      : daysAgo(latest?.asOf ?? new Date().toISOString().slice(0, 10), options.days)
  const priceOn = priceLookup(quotes)
  const events: TimelineEvent[] = []
  const push = (
    at: string,
    type: TimelineEventType,
    title: string,
    detail: string | null,
    meta: Record<string, string | number | null> = {},
  ) => {
    if (since && dateOf(at) < since) return
    const priceAt = priceOn(dateOf(at))
    events.push({
      at,
      type,
      title,
      detail,
      priceAt,
      changeSince: latest && priceAt ? pct(latest.price, priceAt) : null,
      meta,
    })
  }

  for (const s of db
    .select()
    .from(schema.signals)
    .where(eq(schema.signals.instrumentId, instrumentId))
    .all()) {
    push(s.asOf, 'signal', s.kind, `${s.severity} ${s.value}`, {
      kind: s.kind,
      severity: s.severity,
      value: s.value,
      signalId: s.id,
    })
  }
  const actions = db
    .select()
    .from(schema.actions)
    .where(eq(schema.actions.instrumentId, instrumentId))
    .all()
  for (const a of actions) {
    if (a.origin === 'ai') {
      const parsed = parseAdviceBody(a.body)
      push(a.createdAt, 'advice', a.title, null, { stance: parsed.stance, actionId: a.id })
      continue
    }
    push(a.createdAt, 'action', a.title, '作成', {
      actionId: a.id,
      status: 'open',
      origin: a.origin,
    })
    if (a.resolvedAt && a.status !== 'open')
      push(a.resolvedAt, 'action', a.title, a.status === 'done' ? '対応した' : '見送り', {
        actionId: a.id,
        status: a.status,
        note: a.note,
      })
  }
  const assessments = effectiveAssessments(db, { instrumentId }).filter(
    (x) => x.relevance === 'relevant' && x.impact >= 2,
  )
  const newsIds = assessments.filter((x) => x.subjectType === 'news').map((x) => x.subjectId)
  const discIds = assessments.filter((x) => x.subjectType === 'disclosure').map((x) => x.subjectId)
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
  for (const x of assessments) {
    const n = x.subjectType === 'news' ? news.get(x.subjectId) : undefined
    const d = x.subjectType === 'disclosure' ? disc.get(x.subjectId) : undefined
    const at = n?.publishedAt ?? d?.disclosedAt
    if (!at) continue
    push(at, 'assessment', n?.title ?? d?.title ?? '', x.summary, {
      sentiment: x.sentiment,
      impact: x.impact,
      direction: x.direction,
      url: n?.url ?? d?.pdfUrl ?? null,
      assessmentId: x.id,
    })
  }
  // スコア: 週の最初の点だけ
  const seenWeeks = new Set<string>()
  for (const s of scoreHistory(db, instrumentId, 400).sort((a, b) =>
    a.asOf.localeCompare(b.asOf),
  )) {
    const d = new Date(`${s.asOf}T00:00:00Z`)
    const week = `${d.getUTCFullYear()}-${Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 604_800_000)}`
    if (seenWeeks.has(week)) continue
    seenWeeks.add(week)
    push(
      s.asOf,
      'score',
      `スコア ${s.score}`,
      `判定 ${s.components.assessment} / 株価 ${s.components.price} / 財務 ${s.components.financials}`,
      { score: s.score },
    )
  }
  // 保有の変化: スナップショット間の数量差
  const snaps = db
    .select()
    .from(schema.holdingSnapshots)
    .orderBy(asc(schema.holdingSnapshots.asOf))
    .all()
  let prevQty: number | null = null
  for (const snap of snaps) {
    const rows = db
      .select()
      .from(schema.holdings)
      .where(
        and(
          eq(schema.holdings.snapshotId, snap.id),
          eq(schema.holdings.instrumentId, instrumentId),
        ),
      )
      .all()
    const qty = rows.reduce((s, r) => s + r.quantity, 0)
    if (prevQty !== null && qty !== prevQty) {
      push(
        snap.asOf,
        'holding',
        qty > prevQty
          ? `買い増し +${(qty - prevQty).toLocaleString('ja-JP')} 株`
          : `売却 ${(prevQty - qty).toLocaleString('ja-JP')} 株`,
        `${prevQty.toLocaleString('ja-JP')} → ${qty.toLocaleString('ja-JP')} 株`,
        { from: prevQty, to: qty },
      )
    }
    prevQty = qty
  }
  events.sort((a, b) => b.at.localeCompare(a.at))
  return { events, latestPrice: latest?.price ?? null, latestAsOf: latest?.asOf ?? null }
}

export interface HistoryRow {
  actionId: number
  resolvedAt: string
  instrumentId: string
  code: string
  name: string
  kind: string | null
  offense: boolean
  stance: Stance | null
  status: string
  note: string | null
  priceAtDecision: number | null
  priceNow: number | null
  changeSince: number | null
}

export interface HistorySummary {
  key: string
  stance: Stance | 'none'
  status: string
  count: number
  medianChange: number | null
}

const OFFENSE = new Set(['valuation_cheap', 'growth_streak', 'oversold_quality'])

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1
    ? (s[mid] as number)
    : Math.round((((s[mid - 1] as number) + (s[mid] as number)) / 2) * 100) / 100
}

/** 判断の履歴: 対応した / 見送りにしたルール生成のアクション */
export function history(
  db: TradingDatabase,
  options: { since?: string } = {},
): { rows: HistoryRow[]; summary: HistorySummary[] } {
  const conds = [
    eq(schema.actions.origin, 'rule'),
    inArray(schema.actions.status, ['done', 'dismissed']),
  ]
  if (options.since) conds.push(gte(schema.actions.resolvedAt, options.since))
  const acts = db
    .select({
      id: schema.actions.id,
      instrumentId: schema.actions.instrumentId,
      signalId: schema.actions.signalId,
      status: schema.actions.status,
      note: schema.actions.note,
      resolvedAt: schema.actions.resolvedAt,
      code: schema.instruments.code,
      name: schema.instruments.name,
      kind: schema.signals.kind,
    })
    .from(schema.actions)
    .innerJoin(schema.instruments, eq(schema.actions.instrumentId, schema.instruments.id))
    .leftJoin(schema.signals, eq(schema.actions.signalId, schema.signals.id))
    .where(and(...conds))
    .orderBy(desc(schema.actions.resolvedAt))
    .all()
  const signalIds = acts.map((a) => a.signalId).filter((s): s is number => s != null)
  const advices = new Map(
    (signalIds.length
      ? db
          .select()
          .from(schema.actions)
          .where(and(eq(schema.actions.origin, 'ai'), inArray(schema.actions.signalId, signalIds)))
          .all()
      : []
    ).map((a) => [a.signalId, parseAdviceBody(a.body).stance]),
  )
  const now = latestQuotes(db)
  const lookups = new Map<string, (d: string) => number | null>()
  const rows: HistoryRow[] = acts
    .filter((a) => a.resolvedAt)
    .map((a) => {
      let lookup = lookups.get(a.instrumentId)
      if (!lookup) {
        lookup = priceLookup(quoteHistory(db, a.instrumentId, { limit: 400 }))
        lookups.set(a.instrumentId, lookup)
      }
      const priceAtDecision = lookup(dateOf(a.resolvedAt as string))
      const priceNow = now.get(a.instrumentId)?.price ?? null
      return {
        actionId: a.id,
        resolvedAt: a.resolvedAt as string,
        instrumentId: a.instrumentId,
        code: a.code,
        name: a.name,
        kind: a.kind,
        offense: a.kind != null && OFFENSE.has(a.kind),
        stance: a.signalId == null ? null : (advices.get(a.signalId) ?? null),
        status: a.status,
        note: a.note,
        priceAtDecision,
        priceNow,
        changeSince:
          priceNow != null && priceAtDecision != null ? pct(priceNow, priceAtDecision) : null,
      }
    })
  const groups = new Map<string, HistoryRow[]>()
  for (const r of rows) {
    const key = `${r.stance ?? 'none'}:${r.status}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  const summary: HistorySummary[] = [...groups.entries()].map(([key, rs]) => ({
    key,
    stance: (rs[0]?.stance ?? 'none') as Stance | 'none',
    status: rs[0]?.status as string,
    count: rs.length,
    medianChange: median(rs.map((r) => r.changeSince).filter((c): c is number => c != null)),
  }))
  return { rows, summary }
}

/** 折れ線用: 株価（1 年）とスコア */
export function sparklineData(db: TradingDatabase, instrumentId: string) {
  const quotes = quoteHistory(db, instrumentId, { limit: 260 }).sort((a, b) =>
    a.asOf.localeCompare(b.asOf),
  )
  const scores = scoreHistory(db, instrumentId, 260).sort((a, b) => a.asOf.localeCompare(b.asOf))
  const actionDates = new Set(
    db
      .select({ createdAt: schema.actions.createdAt })
      .from(schema.actions)
      .where(and(eq(schema.actions.instrumentId, instrumentId), eq(schema.actions.origin, 'rule')))
      .all()
      .map((a) => dateOf(a.createdAt)),
  )
  return {
    price: quotes.map((q) => ({ x: q.asOf, y: q.price, mark: actionDates.has(q.asOf) })),
    score: scores.map((s) => ({ x: s.asOf, y: s.score, mark: false })),
  }
}
