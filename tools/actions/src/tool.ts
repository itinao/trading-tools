import { defineTool, type ToolContext, ToolError, UsageError } from '@trading/cli'
import { type DatabaseHandle, openDatabase, schema } from '@trading/db'
import { type ActionStatus, getAction, listActions, setActionStatus } from '@trading/domain'

function withDatabase<T>(context: ToolContext, fn: (handle: DatabaseHandle) => T): T {
  const handle = openDatabase(context.dbPath)
  try {
    return fn(handle)
  } finally {
    handle.close()
  }
}

const STATUS_FILTERS = [...schema.ACTION_STATUSES, 'all'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

function parseStatus(value: string, allowed: readonly string[]): string {
  if (!allowed.includes(value)) throw new UsageError(`--status は ${allowed.join(' | ')}: ${value}`)
  return value
}

function parseId(value: string): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new UsageError(`id は正の整数: ${value}`)
  return id
}

export const tool = defineTool({
  name: 'actions',
  description: 'アクション（やるべきこと）の一覧と状態変更',
  commands: [
    {
      name: 'list',
      description: 'アクションを一覧する（既定は open）',
      configure: (c) =>
        c
          .option('--status <status>', `${STATUS_FILTERS.join(' | ')}`, 'open')
          .option('--instrument <id>', '銘柄 id（例 JP:7203）で絞る'),
      handler: (options: { status: string; instrument?: string }, context) => {
        const status = parseStatus(options.status, STATUS_FILTERS) as StatusFilter
        return withDatabase(context, (handle) =>
          listActions(handle.db, {
            status,
            ...(options.instrument ? { instrumentId: options.instrument } : {}),
          }),
        )
      },
    },
    {
      name: 'show',
      description: 'アクション1件（本文つき）',
      configure: (c) => c.argument('<id>'),
      handler: (_options, context, [id]) =>
        withDatabase(context, (handle) => {
          const action = getAction(handle.db, parseId(id as string))
          if (!action) throw new ToolError('not_found', `アクション ${id} はありません`)
          return action
        }),
    },
    {
      name: 'resolve',
      description: '状態を変える（done | dismissed | open）',
      configure: (c) =>
        c
          .argument('<id>')
          .requiredOption('--status <status>', schema.ACTION_STATUSES.join(' | '))
          .option('--note <text>', '対応時のメモ'),
      handler: (options: { status: string; note?: string }, context, [id]) => {
        const status = parseStatus(options.status, schema.ACTION_STATUSES) as ActionStatus
        const actionId = parseId(id as string)
        return withDatabase(context, (handle) => {
          if (context.options.dryRun) {
            const current = getAction(handle.db, actionId)
            if (!current) throw new ToolError('not_found', `アクション ${actionId} はありません`)
            return { id: actionId, from: current.status, to: status, dryRun: true }
          }
          const result = setActionStatus(handle.db, actionId, status, options.note)
          if (!result) throw new ToolError('not_found', `アクション ${actionId} はありません`)
          context.logger.info(`action ${actionId} -> ${status}`)
          return result
        })
      },
    },
  ],
})
