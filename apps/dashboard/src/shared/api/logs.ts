import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@trading/cli'

export interface LastCollect {
  date: string
  finishedAt: string | null
  status: number | null
}

/** launchd の日次ログ（data/logs/daily-YYYY-MM-DD.log）から最終実行を読む。無ければ null */
export function lastCollectRun(): LastCollect | null {
  const dir = join(findWorkspaceRoot(), 'data', 'logs')
  let files: string[]
  try {
    files = readdirSync(dir)
      .filter((f) => /^daily-\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .sort()
  } catch {
    return null
  }
  const latest = files.at(-1)
  if (!latest) return null
  const text = readFileSync(join(dir, latest), 'utf8')
  const done = [...text.matchAll(/=== (\S+) done status=(\d+)/g)].at(-1)
  return {
    date: latest.slice(6, 16),
    finishedAt: done?.[1] ?? null,
    status: done ? Number(done[2]) : null,
  }
}
