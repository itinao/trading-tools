import { resolveDbPath } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'

/**
 * SQLite への接続。プロセスで 1 本を使い回す（Design Doc 0018 §2）。
 * ダッシュボードの shared/api/db.ts と同じ考え方で、ツールを呼ぶたびに開き直さない。
 */

let handle: DatabaseHandle | undefined

export function openMcpDatabase(dbPath?: string): void {
  handle = openDatabase(resolveDbPath(dbPath))
}

export function db() {
  if (!handle) throw new Error('openMcpDatabase を先に呼ぶ')
  return handle.db
}

/** テスト用。作成済みのハンドルを差し込む */
export function setHandleForTest(h: DatabaseHandle): void {
  handle = h
}

export function closeMcpDatabase(): void {
  handle?.close()
  handle = undefined
}
