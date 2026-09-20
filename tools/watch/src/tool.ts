import { defineTool, type ToolContext, ToolError, UsageError } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'
import {
  addWatch,
  latestQuotes,
  latestScores,
  listActions,
  listWatches,
  quoteHistory,
  removeWatch,
  WatchError,
} from '@trading/domain'

function withDatabase<T>(context: ToolContext, fn: (handle: DatabaseHandle) => T): T {
  const handle = openDatabase(context.dbPath)
  try {
    return fn(handle)
  } finally {
    handle.close()
  }
}

function parseCode(value: string): string {
  const code = value.trim().toUpperCase()
  if (!/^\d[0-9A-Z]{3}$/.test(code)) throw new UsageError(`証券コードは 4 桁: ${value}`)
  return code
}

const wrap = <T>(fn: () => T): T => {
  try {
    return fn()
  } catch (e) {
    if (e instanceof WatchError) throw new ToolError(e.code, e.message)
    throw e
  }
}

export const tool = defineTool({
  name: 'watch',
  description: 'ウォッチ銘柄（まだ持っていないが監視する銘柄）の追加・削除・一覧',
  commands: [
    {
      name: 'add',
      description: 'ウォッチに追加する。銘柄名は上場銘柄一覧（pnpm collect universe）から取る',
      configure: (c) =>
        c
          .argument('<code>')
          .option('--note <text>', 'なぜ見ているか')
          .option('--name <name>', '銘柄名（一覧に無いとき）'),
      handler: (options: { note?: string; name?: string }, context, [codeArg]) => {
        const code = parseCode(codeArg as string)
        return withDatabase(context, (handle) => {
          if (context.options.dryRun) return { code, dryRun: true }
          const r = wrap(() =>
            addWatch(handle.db, code, {
              ...(options.note ? { note: options.note } : {}),
              ...(options.name ? { name: options.name } : {}),
            }),
          )
          context.logger.info(
            `watching ${r.code} ${r.name}。次の collect quotes で日足が 1 年分入る`,
          )
          return r
        })
      },
    },
    {
      name: 'remove',
      description: 'ウォッチから外す（銘柄と事実は残る）',
      configure: (c) => c.argument('<code>'),
      handler: (_o, context, [codeArg]) => {
        const code = parseCode(codeArg as string)
        return withDatabase(context, (handle) => {
          if (context.options.dryRun) return { code, dryRun: true }
          return wrap(() => removeWatch(handle.db, code))
        })
      },
    },
    {
      name: 'list',
      description: 'ウォッチ一覧（最新の株価・スコア・未対応アクション数つき）',
      handler: (_o, context) =>
        withDatabase(context, (handle) => {
          const quotes = latestQuotes(handle.db)
          const scores = latestScores(handle.db)
          const open = listActions(handle.db, { status: 'open' })
          return listWatches(handle.db).map((w) => {
            const q = quotes.get(w.instrumentId)
            const hist = q
              ? quoteHistory(handle.db, w.instrumentId, { upTo: q.asOf, limit: 60 })
              : []
            const high60 = hist.length > 0 ? Math.max(...hist.map((x) => x.price)) : null
            return {
              instrumentId: w.instrumentId,
              code: w.code,
              name: w.name,
              addedAt: w.watch?.addedAt ?? null,
              note: w.watch?.note ?? null,
              price: q?.price ?? null,
              priceAsOf: q?.asOf ?? null,
              drawdownFromHigh60:
                q && high60 ? Math.round(((q.price - high60) / high60) * 10000) / 100 : null,
              score: scores.get(w.instrumentId)?.score ?? null,
              openActions: open.filter((a) => a.instrumentId === w.instrumentId).length,
            }
          })
        }),
    },
  ],
})
