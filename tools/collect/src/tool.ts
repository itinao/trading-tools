import { defineTool, type ToolContext, ToolError } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'
import { holdingTargets } from '@trading/domain'
import { collectDisclosures } from './disclosures.ts'
import { collectFinancials } from './financials.ts'
import { collectFundamentals } from './fundamentals.ts'
import { collectNews } from './news.ts'
import { defaultProviders, type Providers, resolveQuoteProvider } from './providers.ts'
import { collectQuotes, type QuotesOptions } from './quotes.ts'

async function withDatabase<T>(
  context: ToolContext,
  fn: (handle: DatabaseHandle) => Promise<T>,
): Promise<T> {
  const handle = openDatabase(context.dbPath)
  try {
    return await fn(handle)
  } finally {
    handle.close()
  }
}

const dry = <T extends object>(context: ToolContext, r: T) =>
  context.options.dryRun ? { ...r, dryRun: true } : r

export const tool = defineTool({
  name: 'collect',
  description: '市場データ（株価・指標・財務・ニュース・開示）を取得して保存する',
  commands: [
    {
      name: 'quotes',
      description: '保有銘柄の株価。株価が 1 件もない銘柄は日足を 1 年分遡る',
      configure: (c) =>
        c
          .option(
            '--provider <name>',
            '取得元（yahoo | mock）。省略時は TRADING_QUOTE_PROVIDER、既定 yahoo',
          )
          .option('--as-of <date>', 'YYYY-MM-DD。省略時は取得元が返す日付（mock は今日）')
          .option('--backfill [from]', '全銘柄の日足を遡る。from は YYYY-MM-DD（省略時は 1 年前）'),
      handler: (options: QuotesOptions, context) =>
        withDatabase(context, async (handle) => {
          const provider = resolveQuoteProvider(
            options.provider,
            process.env,
            holdingTargets(handle.db),
          )
          return dry(context, await collectQuotes(handle, context, options, provider))
        }),
    },
    {
      name: 'fundamentals',
      description: '保有銘柄の指標（PER / PBR / 配当利回り / ROE など）',
      handler: (_o, context) =>
        withDatabase(context, async (handle) =>
          dry(
            context,
            await collectFundamentals(
              handle,
              context,
              defaultProviders(undefined, process.env, []).fundamentals,
            ),
          ),
        ),
    },
    {
      name: 'financials',
      description: '保有銘柄の財務諸表（年次・四半期）',
      handler: (_o, context) =>
        withDatabase(context, async (handle) =>
          dry(
            context,
            await collectFinancials(
              handle,
              context,
              defaultProviders(undefined, process.env, []).financials,
            ),
          ),
        ),
    },
    {
      name: 'news',
      description: '保有銘柄のニュースの見出し',
      handler: (_o, context) =>
        withDatabase(context, async (handle) =>
          dry(
            context,
            await collectNews(handle, context, defaultProviders(undefined, process.env, []).news),
          ),
        ),
    },
    {
      name: 'disclosures',
      description: '保有銘柄の適時開示（既定は今日と前日）',
      configure: (c) => c.option('--date <date>', 'YYYY-MM-DD'),
      handler: (options: { date?: string }, context) =>
        withDatabase(context, async (handle) =>
          dry(
            context,
            await collectDisclosures(
              handle,
              context,
              options,
              defaultProviders(undefined, process.env, []).disclosures,
            ),
          ),
        ),
    },
    {
      name: 'all',
      description:
        'quotes → fundamentals → financials → news → disclosures を順に実行する。1 つが失敗しても続ける',
      configure: (c) => c.option('--provider <name>', '株価の取得元（yahoo | mock）'),
      handler: (options: { provider?: string }, context) =>
        withDatabase(context, async (handle) => {
          const providers = defaultProviders(
            options.provider,
            process.env,
            holdingTargets(handle.db),
          )
          return dry(context, await collectAll(handle, context, providers))
        }),
    },
  ],
})

export async function collectAll(
  handle: DatabaseHandle,
  context: ToolContext,
  providers: Providers,
) {
  const out: Record<string, unknown> = {}
  const errors: Record<string, { code: string; message: string }> = {}
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn()
    } catch (e) {
      const err =
        e instanceof ToolError
          ? { code: e.code, message: e.message }
          : { code: 'internal', message: e instanceof Error ? e.message : String(e) }
      errors[name] = err
      context.logger.error(`${name}: ${err.message}`)
    }
  }
  await step('quotes', () => collectQuotes(handle, context, {}, providers.quotes))
  await step('fundamentals', () => collectFundamentals(handle, context, providers.fundamentals))
  await step('financials', () => collectFinancials(handle, context, providers.financials))
  await step('news', () => collectNews(handle, context, providers.news))
  await step('disclosures', () => collectDisclosures(handle, context, {}, providers.disclosures))
  if (Object.keys(out).length === 0)
    throw new ToolError('all_failed', 'すべての収集に失敗しました', { details: errors })
  return { ...out, ...(Object.keys(errors).length > 0 ? { errors } : {}) }
}
