import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const DEFAULT_DB_PATH = 'data/trading.db'

/** pnpm-workspace.yaml を上に辿ってリポジトリのルートを見つける。見つからなければ cwd。 */
export function findWorkspaceRoot(from: string = process.cwd()): string {
  let dir = resolve(from)
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return resolve(from)
    dir = parent
  }
}

/**
 * DB の場所。優先順: --db > TRADING_DB_PATH > data/trading.db。
 * 相対パスはリポジトリのルート基準。`:memory:` はそのまま返す。
 */
export function resolveDbPath(
  explicit: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  root: string = findWorkspaceRoot(),
): string {
  const candidate = explicit ?? env.TRADING_DB_PATH ?? DEFAULT_DB_PATH
  if (candidate === ':memory:') return candidate
  return resolve(root, candidate)
}
