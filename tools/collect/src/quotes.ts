import { isIsoDate, nowJst, type ToolContext, ToolError, todayJst, UsageError } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import type { QuoteProvider } from '@trading/market-data'
import { count, eq, sql } from 'drizzle-orm'
import { type Failed, logFailures, requireTargets } from './shared.ts'

export interface QuotesOptions {
  provider?: string
  asOf?: string
  /** 全銘柄の日足を遡って取る。値は YYYY-MM-DD（省略時は 1 年前） */
  backfill?: string | boolean
}

export interface QuotesResult {
  asOf: string
  provider: string
  targets: number
  fetched: number
  failed: Failed[]
  backfilled: { code: string; bars: number }[]
}

function oneYearAgo(): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - 1)
  return todayJst(d)
}

/** 株価が 1 件もない銘柄（新しく保有した銘柄）を返す */
function instrumentsWithoutQuotes(handle: DatabaseHandle, instrumentIds: string[]): Set<string> {
  const rows = handle.db
    .select({ instrumentId: schema.quotes.instrumentId, n: count() })
    .from(schema.quotes)
    .groupBy(schema.quotes.instrumentId)
    .all()
  const have = new Set(rows.filter((r) => r.n > 0).map((r) => r.instrumentId))
  return new Set(instrumentIds.filter((id) => !have.has(id)))
}

function upsertQuotes(handle: DatabaseHandle, rows: (typeof schema.quotes.$inferInsert)[]): void {
  if (rows.length === 0) return
  // 同じ (instrument, as_of, source) は上書き（Design Doc 0003 §3.3）
  handle.db
    .insert(schema.quotes)
    .values(rows)
    .onConflictDoUpdate({
      target: [schema.quotes.instrumentId, schema.quotes.asOf, schema.quotes.source],
      set: {
        price: sql`excluded.price`,
        previousClose: sql`excluded.previous_close`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    })
    .run()
}

export async function collectQuotes(
  handle: DatabaseHandle,
  context: ToolContext,
  options: QuotesOptions,
  provider: QuoteProvider,
): Promise<QuotesResult> {
  if (options.asOf !== undefined && !isIsoDate(options.asOf))
    throw new UsageError(`--as-of は YYYY-MM-DD: ${options.asOf}`)
  const targets = requireTargets(handle)
  context.logger.info(`provider=${provider.name} targets=${targets.length}`)
  const fetchedAt = nowJst()
  const byCode = new Map(targets.map((t) => [t.code, t]))

  // 日足の遡り: --backfill 指定なら全銘柄、そうでなければ株価 0 件の銘柄だけ
  const backfilled: QuotesResult['backfilled'] = []
  const failed: Failed[] = []
  if (provider.fetchHistory) {
    const from = typeof options.backfill === 'string' ? options.backfill : oneYearAgo()
    if (typeof options.backfill === 'string' && !isIsoDate(from))
      throw new UsageError(`--backfill は YYYY-MM-DD: ${from}`)
    const missing = instrumentsWithoutQuotes(
      handle,
      targets.map((t) => t.instrumentId),
    )
    const toBackfill = targets.filter((t) => options.backfill || missing.has(t.instrumentId))
    for (const t of toBackfill) {
      try {
        const bars = await provider.fetchHistory(t.code, from)
        context.logger.info(`${t.code}: backfill ${bars.length} bars from ${from}`)
        if (!context.options.dryRun) {
          upsertQuotes(
            handle,
            bars.map((b, i) => ({
              instrumentId: t.instrumentId,
              asOf: b.asOf,
              price: b.close,
              previousClose: i > 0 ? (bars[i - 1]?.close ?? null) : null,
              source: provider.name,
              fetchedAt,
            })),
          )
        }
        backfilled.push({ code: t.code, bars: bars.length })
      } catch (e) {
        failed.push({
          code: t.code,
          reason: `backfill: ${e instanceof Error ? e.message : String(e)}`,
        })
      }
    }
  }

  const results = await provider.fetchQuotes(targets.map((t) => t.code))
  const rows: (typeof schema.quotes.$inferInsert)[] = []
  let asOf = options.asOf ?? todayJst()
  for (const r of results) {
    const target = byCode.get(r.code)
    if (!target) continue
    if (!r.ok) {
      failed.push({ code: r.code, reason: r.reason })
      continue
    }
    // Provider が as_of を返せばそれを使う（休日は直近の営業日になる）。--as-of 指定はそれを優先
    const rowAsOf = options.asOf ?? r.asOf ?? asOf
    asOf = rowAsOf
    rows.push({
      instrumentId: target.instrumentId,
      asOf: rowAsOf,
      price: r.price,
      previousClose: r.previousClose ?? null,
      source: provider.name,
      fetchedAt,
    })
  }
  if (rows.length === 0 && backfilled.length === 0) {
    throw new ToolError('all_failed', 'すべての銘柄で取得に失敗しました', { details: { failed } })
  }
  logFailures(context, failed)
  if (!context.options.dryRun) upsertQuotes(handle, rows)
  return {
    asOf,
    provider: provider.name,
    targets: targets.length,
    fetched: rows.length,
    failed,
    backfilled,
  }
}

/** 銘柄ごとの株価件数（テストとログ用） */
export function quoteCount(handle: DatabaseHandle, instrumentId: string): number {
  return (
    handle.db
      .select({ n: count() })
      .from(schema.quotes)
      .where(eq(schema.quotes.instrumentId, instrumentId))
      .get()?.n ?? 0
  )
}
