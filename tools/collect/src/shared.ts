import { type ToolContext, ToolError } from '@trading/cli'
import type { DatabaseHandle } from '@trading/db'
import { monitoredTargets, type Target } from '@trading/domain'

export interface Failed {
  code: string
  reason: string
}

/** 収集対象 = 保有 ∪ ウォッチ（Design Doc 0013）。無ければ no_targets */
export function requireTargets(handle: DatabaseHandle): Target[] {
  const targets = monitoredTargets(handle.db)
  if (targets.length === 0) {
    throw new ToolError(
      'no_targets',
      '収集対象の銘柄がありません。先に import-holdings を実行してください',
    )
  }
  return targets
}

export function logFailures(context: ToolContext, failed: Failed[]): void {
  for (const f of failed) context.logger.warn(`${f.code}: ${f.reason}`)
}
