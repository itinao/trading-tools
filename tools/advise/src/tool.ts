import { defineTool, type ToolContext, ToolError, UsageError } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'
import {
  AdviceError,
  type AdviceInput,
  pendingAdvice,
  recordAdvice,
  validateAdviceInput,
} from '@trading/domain'

function withDatabase<T>(context: ToolContext, fn: (handle: DatabaseHandle) => T): T {
  const handle = openDatabase(context.dbPath)
  try {
    return fn(handle)
  } finally {
    handle.close()
  }
}

export function parseRecordInput(raw: unknown): AdviceInput[] {
  if (!Array.isArray(raw)) throw new UsageError('--input は助言の配列です')
  const errors: string[] = []
  const values: AdviceInput[] = []
  raw.forEach((r, i) => {
    const v = validateAdviceInput(r, i)
    if (v.ok) values.push(v.value)
    else errors.push(v.error)
  })
  if (errors.length > 0)
    throw new ToolError(
      'invalid_input',
      `${errors.length} 件の助言が不正です。1 件も書き込みません`,
      { details: errors },
    )
  return values
}

export const tool = defineTool({
  name: 'advise',
  description: 'アクションへの AI 助言（エージェントがスキルで書き、CLI 経由で保存する）',
  commands: [
    {
      name: 'pending',
      description: '助言がまだ無い未対応アクションを、判断に必要な事実の束と一緒に JSON で出す',
      configure: (c) => c.option('--limit <n>', '最大件数', '20'),
      handler: (options: { limit: string }, context) => {
        const limit = Number(options.limit)
        if (!Number.isInteger(limit) || limit <= 0)
          throw new UsageError(`--limit は正の整数: ${options.limit}`)
        return withDatabase(context, (handle) => pendingAdvice(handle.db, limit))
      },
    },
    {
      name: 'record',
      description: '助言を書き込む（--input に配列。不正な要素や二重付与があれば全体を失敗にする）',
      handler: (_o, context) => {
        const inputs = parseRecordInput(context.readInput())
        if (context.options.dryRun) return { written: 0, valid: inputs.length, dryRun: true }
        return withDatabase(context, (handle) => {
          try {
            return recordAdvice(handle.db, inputs)
          } catch (e) {
            if (e instanceof AdviceError) throw new ToolError(e.code, e.message)
            throw e
          }
        })
      },
    },
  ],
})
