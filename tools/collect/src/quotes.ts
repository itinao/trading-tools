import { join } from 'node:path'
import {
  findWorkspaceRoot,
  isIsoDate,
  nowJst,
  type ToolContext,
  ToolError,
  todayJst,
  UsageError,
} from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import { holdingTargets, type Target } from '@trading/domain'
import { createMockProvider, type QuoteProvider } from '@trading/market-data'
import { sql } from 'drizzle-orm'

export const MOCK_QUOTES_PATH = 'data/source/mock-quotes.json'

export interface QuotesOptions {
  provider?: string
  asOf?: string
}

export interface QuotesResult {
  asOf: string
  provider: string
  targets: number
  fetched: number
  failed: { code: string; reason: string }[]
}

export function resolveProvider(
  name: string | undefined,
  env: NodeJS.ProcessEnv,
  targets: Target[],
): QuoteProvider {
  const selected = name ?? env.TRADING_QUOTE_PROVIDER ?? 'mock'
  switch (selected) {
    case 'mock':
      return createMockProvider({
        filePath: join(findWorkspaceRoot(), MOCK_QUOTES_PATH),
        seed: () => Object.fromEntries(targets.map((t) => [t.code, t.priceAtSnapshot])),
      })
    default:
      throw new UsageError(`未知の provider: ${selected}`, { known: ['mock'] })
  }
}

export async function collectQuotes(
  handle: DatabaseHandle,
  context: ToolContext,
  options: QuotesOptions,
  providerFactory: (targets: Target[]) => QuoteProvider = (t) =>
    resolveProvider(options.provider, process.env, t),
): Promise<QuotesResult> {
  const asOf = options.asOf ?? todayJst()
  if (!isIsoDate(asOf)) throw new UsageError(`--as-of は YYYY-MM-DD: ${asOf}`)

  const targets = holdingTargets(handle.db)
  if (targets.length === 0) {
    throw new ToolError(
      'no_targets',
      '収集対象の銘柄がありません。先に import-holdings を実行してください',
    )
  }
  const provider = providerFactory(targets)
  context.logger.info(`provider=${provider.name} asOf=${asOf} targets=${targets.length}`)

  const results = await provider.fetchQuotes(
    targets.map((t) => t.code),
    asOf,
  )
  const byCode = new Map(targets.map((t) => [t.code, t]))
  const failed: QuotesResult['failed'] = []
  const rows: (typeof schema.quotes.$inferInsert)[] = []
  const fetchedAt = nowJst()
  for (const r of results) {
    const target = byCode.get(r.code)
    if (!target) continue
    if (!r.ok) {
      failed.push({ code: r.code, reason: r.reason })
      continue
    }
    rows.push({
      instrumentId: target.instrumentId,
      asOf,
      price: r.price,
      previousClose: r.previousClose ?? null,
      source: provider.name,
      fetchedAt,
    })
  }
  if (rows.length === 0) {
    throw new ToolError('all_failed', 'すべての銘柄で取得に失敗しました', { details: { failed } })
  }
  for (const f of failed) context.logger.warn(`${f.code}: ${f.reason}`)

  if (!context.options.dryRun) {
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
  return { asOf, provider: provider.name, targets: targets.length, fetched: rows.length, failed }
}
