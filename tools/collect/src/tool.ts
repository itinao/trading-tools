import { defineTool, type ToolContext } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'
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

export const tool = defineTool({
  name: 'collect',
  description: '市場データ（株価など）を取得して保存する',
  commands: [
    {
      name: 'quotes',
      description: '保有銘柄の株価を取得する',
      configure: (c) =>
        c
          .option('--provider <name>', '取得元（mock）。省略時は TRADING_QUOTE_PROVIDER、既定 mock')
          .option('--as-of <date>', 'YYYY-MM-DD。省略時は今日（Asia/Tokyo）'),
      handler: (options: QuotesOptions, context) =>
        withDatabase(context, async (handle) => {
          const result = await collectQuotes(handle, context, options)
          return context.options.dryRun ? { ...result, dryRun: true } : result
        }),
    },
  ],
})
