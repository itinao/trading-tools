import { defineTool, type ToolContext } from '@trading/cli'
import { migrate, migrationStatus, openDatabase } from '@trading/db'

function withDatabase<T>(
  context: ToolContext,
  fn: (handle: ReturnType<typeof openDatabase>) => T,
): T {
  const handle = openDatabase(context.dbPath)
  try {
    return fn(handle)
  } finally {
    handle.close()
  }
}

export const tool = defineTool({
  name: 'db',
  description: 'データストア（SQLite）のマイグレーションと状態表示',
  commands: [
    {
      name: 'migrate',
      description: '未適用のマイグレーションを適用する',
      handler: (_options, context) =>
        withDatabase(context, (handle) => {
          if (context.options.dryRun) {
            const status = migrationStatus(handle)
            return { path: handle.path, ...status, dryRun: true }
          }
          const result = migrate(handle)
          context.logger.info(
            result.newlyApplied.length > 0
              ? `applied: ${result.newlyApplied.join(', ')}`
              : 'nothing to apply',
          )
          return { path: handle.path, ...result }
        }),
    },
    {
      name: 'status',
      description: '適用済み・未適用のマイグレーションを表示する',
      handler: (_options, context) =>
        withDatabase(context, (handle) => ({ path: handle.path, ...migrationStatus(handle) })),
    },
  ],
})
