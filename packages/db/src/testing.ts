import { type DatabaseHandle, migrate, openDatabase } from './client.ts'

/** テスト用: メモリ DB を開いてマイグレーションを当てた状態で返す */
export function createTestDatabase(): DatabaseHandle {
  const handle = openDatabase(':memory:')
  migrate(handle)
  return handle
}
