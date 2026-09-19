import { isIsoDate, nowJst, type ToolContext, todayJst, UsageError } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import { type Position, positions, quoteHistory } from '@trading/domain'
import { and, desc, eq } from 'drizzle-orm'
import { actionText } from './actions-text.ts'
import type { DetectConfig } from './config.ts'
import { evaluateAll, type RuleHit, SIGNAL_KINDS, type SignalKind } from './rules.ts'

export interface RunResult {
  asOf: string
  evaluated: number
  skipped: { code: string; kind: SignalKind | 'all'; reason: string }[]
  signals: { created: number; updated: number }
  actions: { created: number; suppressed: number }
}

const SEVERITY_RANK = { warn: 1, critical: 2 } as const

export function runDetect(
  handle: DatabaseHandle,
  context: ToolContext,
  options: { asOf?: string },
  config: DetectConfig,
): RunResult {
  const asOf = options.asOf ?? todayJst()
  if (!isIsoDate(asOf)) throw new UsageError(`--as-of は YYYY-MM-DD: ${asOf}`)
  const { db } = handle
  const result: RunResult = {
    asOf,
    evaluated: 0,
    skipped: [],
    signals: { created: 0, updated: 0 },
    actions: { created: 0, suppressed: 0 },
  }
  const now = nowJst()

  const write = (fn: () => void) => {
    if (!context.options.dryRun) fn()
  }

  for (const position of positions(db)) {
    const history = quoteHistory(db, position.instrumentId, {
      upTo: asOf,
      limit: config.below_ma200.window + 1,
    })
    if (history[0]?.asOf !== asOf) {
      result.skipped.push({ code: position.code, kind: 'all', reason: `no quote for ${asOf}` })
      continue
    }
    result.evaluated++
    const outcomes = evaluateAll(history, position.averageCost, config)
    for (const kind of SIGNAL_KINDS) {
      const outcome = outcomes[kind]
      if (outcome === null) continue
      if ('skipped' in outcome) {
        result.skipped.push({ code: position.code, kind, reason: outcome.skipped })
        continue
      }
      context.logger.info(`${position.code} ${kind} ${outcome.severity} ${outcome.value}%`)
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
  position: Position,
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
