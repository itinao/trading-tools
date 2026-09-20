import { defineTool, isIsoDate, type ToolContext, ToolError, UsageError } from '@trading/cli'
import { type DatabaseHandle, openDatabase, schema } from '@trading/db'
import { history, timeline } from '@trading/domain'
import { eq } from 'drizzle-orm'

function withDatabase<T>(context: ToolContext, fn: (handle: DatabaseHandle) => T): T {
  const handle = openDatabase(context.dbPath)
  try {
    return fn(handle)
  } finally {
    handle.close()
  }
}

export const tool = defineTool({
  name: 'review',
  description: '振り返り: 銘柄のタイムラインと、判断の履歴（Design Doc 0014）',
  commands: [
    {
      name: 'timeline',
      description:
        '銘柄の出来事を新しい順に（シグナル・アクション・助言・判定・スコア・保有の変化）',
      configure: (c) => c.argument('<code>').option('--days <n>', '直近 N 日。all で全期間', '90'),
      handler: (options: { days: string }, context, [codeArg]) => {
        const code = String(codeArg).trim().toUpperCase()
        if (!/^\d[0-9A-Z]{3}$/.test(code)) throw new UsageError(`証券コードは 4 桁: ${codeArg}`)
        const days = options.days === 'all' ? null : Number(options.days)
        if (days !== null && (!Number.isInteger(days) || days <= 0))
          throw new UsageError(`--days は正の整数か all: ${options.days}`)
        return withDatabase(context, (handle) => {
          const id = schema.instrumentId('JP', code)
          const instrument = handle.db
            .select()
            .from(schema.instruments)
            .where(eq(schema.instruments.id, id))
            .get()
          if (!instrument) throw new ToolError('not_found', `${code} は登録されていません`)
          return {
            instrument: { id, code, name: instrument.name },
            days,
            ...timeline(handle.db, id, { days }),
          }
        })
      },
    },
    {
      name: 'history',
      description: '対応した / 見送りにしたアクションと、stance × 判断の集計',
      configure: (c) => c.option('--since <date>', 'YYYY-MM-DD 以降の判断'),
      handler: (options: { since?: string }, context) => {
        if (options.since !== undefined && !isIsoDate(options.since))
          throw new UsageError(`--since は YYYY-MM-DD: ${options.since}`)
        return withDatabase(context, (handle) =>
          history(handle.db, options.since ? { since: options.since } : {}),
        )
      },
    },
  ],
})
