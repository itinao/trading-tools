import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { tool } from '../src/tool.ts'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function run(argv: string[]) {
  const out: string[] = []
  return tool
    .run(argv, { stdout: (t) => void out.push(t), stderr: () => {}, env: {} })
    .then((code) => ({ code, json: JSON.parse(out.join('')) }))
}

describe('db migrate', () => {
  it('DB ファイルを作り、pending が空になる', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tool-db-'))
    dirs.push(dir)
    const path = join(dir, 'trading.db')
    const { code, json } = await run(['--db', path, 'migrate'])
    expect(code).toBe(0)
    expect(json.ok).toBe(true)
    expect(json.data.path).toBe(path)
    expect(json.data.pending).toEqual([])
    expect(existsSync(path)).toBe(true)
  })

  it('--dry-run では DB ファイルを作るが適用はしない', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tool-db-'))
    dirs.push(dir)
    const { json } = await run(['--db', join(dir, 'x.db'), '--dry-run', 'migrate'])
    expect(json.data.dryRun).toBe(true)
    expect(json.data).not.toHaveProperty('newlyApplied')
  })
})

describe('db status', () => {
  it('メモリ DB でも動く', async () => {
    const { code, json } = await run(['--db', ':memory:', 'status'])
    expect(code).toBe(0)
    expect(json.data.path).toBe(':memory:')
    expect(json.data.applied).toEqual([])
    expect(json.data.pending.length).toBeGreaterThan(0)
  })
})
