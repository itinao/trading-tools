import { resolveDbPath } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'

let handle: DatabaseHandle | undefined

/** サーバー専用。プロセスで1つの接続を使い回す */
export function db() {
  handle ??= openDatabase(resolveDbPath(undefined))
  return handle.db
}
