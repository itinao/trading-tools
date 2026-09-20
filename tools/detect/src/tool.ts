import { defineTool, type ToolContext } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'
import { loadConfig } from './config.ts'
import { runDetect } from './run.ts'

function withDatabase<T>(context: ToolContext, fn: (handle: DatabaseHandle) => T): T {
  const handle = openDatabase(context.dbPath)
  try {
    return fn(handle)
  } finally {
    handle.close()
  }
}

export const tool = defineTool({
  name: 'detect',
  description: '株価の下落を検知し、シグナルとアクションを作る',
  commands: [
    {
      name: 'run',
      description: '保有銘柄を評価する',
      configure: (c) => c.option('--as-of <date>', 'YYYY-MM-DD。省略時は株価の最新日'),
      handler: (options: { asOf?: string }, context) => {
        const config = loadConfig()
        return withDatabase(context, (handle) => {
          const result = runDetect(handle, context, options, config)
          return context.options.dryRun ? { ...result, dryRun: true } : result
        })
      },
    },
  ],
})
