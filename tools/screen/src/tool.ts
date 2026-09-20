import { defineTool, type ToolContext, ToolError, UsageError } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'
import { getScreenRun, listScreenRuns } from '@trading/domain'
import { createYahooProvider } from '@trading/market-data'
import { buildCriteria, type CliOptions, loadScreenConfig } from './criteria.ts'
import { runScreen } from './run.ts'

async function withDatabase<T>(
  context: ToolContext,
  fn: (handle: DatabaseHandle) => Promise<T> | T,
): Promise<T> {
  const handle = openDatabase(context.dbPath)
  try {
    return await fn(handle)
  } finally {
    handle.close()
  }
}

export const tool = defineTool({
  name: 'screen',
  description: '東証の上場銘柄から条件で候補を探す（母集団は pnpm collect universe）',
  commands: [
    {
      name: 'run',
      description:
        'スクリーニングを実行して保存する。既定 < プリセット < オプションの順に条件を重ねる',
      configure: (c) =>
        c
          .option('--preset <name>', 'config/screen.json のプリセット（value | growth | quality）')
          .option('--segment <list>', 'prime,standard など')
          .option('--sector <list>', '33 業種区分（カンマ区切り）')
          .option('--per-max <n>')
          .option('--pbr-max <n>')
          .option('--dividend-min <pct>')
          .option('--market-cap-min <yen>')
          .option('--growth-years <n>', '増収増益の連続年数')
          .option('--roe-min <pct>')
          .option('--operating-margin-min <pct>')
          .option('--equity-ratio-min <pct>')
          .option('--sort <key>', 'dividendYield | per | pbr | marketCap | growthYears')
          .option('--limit <n>'),
      handler: (options: CliOptions, context) => {
        const built = buildCriteria(options, loadScreenConfig())
        const yahoo = createYahooProvider()
        return withDatabase(context, (handle) =>
          runScreen(handle, context, built, {
            metrics: yahoo,
            financials: yahoo,
            fundamentals: yahoo,
          }),
        )
      },
    },
    {
      name: 'list',
      description: '過去の実行',
      handler: (_o, context) => withDatabase(context, (handle) => listScreenRuns(handle.db)),
    },
    {
      name: 'show',
      description: '実行の結果',
      configure: (c) => c.argument('<run-id>'),
      handler: (_o, context, [id]) =>
        withDatabase(context, (handle) => {
          const n = Number(id)
          if (!Number.isInteger(n) || n <= 0) throw new UsageError(`run-id は正の整数: ${id}`)
          const run = getScreenRun(handle.db, n)
          if (!run) throw new ToolError('not_found', `実行 ${n} はありません`)
          return run
        }),
    },
  ],
})
