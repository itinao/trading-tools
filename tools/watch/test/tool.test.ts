import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate, openDatabase, schema } from '@trading/db'
import { afterEach, describe, expect, it } from 'vitest'
import { tool } from '../src/tool.ts'

const NOW = '2026-01-01T00:00:00+09:00'
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'watch-'))
  dirs.push(dir)
  const path = join(dir, 'test.db')
  const handle = openDatabase(path)
  migrate(handle)
  handle.db
    .insert(schema.universe)
    .values({
      code: '7203',
      name: 'トヨタ自動車',
      segment: 'prime',
      segmentRaw: 'プライム',
      sector33: '輸送用機器',
      size: null,
      listedAsOf: '2026-08-31',
      fetchedAt: NOW,
    })
    .run()
  handle.close()
  return path
}
async function run(argv: string[]) {
  const out: string[] = []
  const code = await tool.run(argv, { stdout: (t) => void out.push(t), stderr: () => {}, env: {} })
  return { code, json: JSON.parse(out.join('')) }
}

describe('watch CLI', () => {
  it('add → list → remove', async () => {
    const db = tempDb()
    const a = await run(['--db', db, 'add', '7203', '--note', '割安'])
    expect(a.code).toBe(0)
    expect(a.json.data).toMatchObject({ instrumentId: 'JP:7203', name: 'トヨタ自動車' })
    const l = await run(['--db', db, 'list'])
    expect(l.json.data).toHaveLength(1)
    expect(l.json.data[0]).toMatchObject({
      code: '7203',
      note: '割安',
      price: null,
      score: null,
      openActions: 0,
    })
    expect((await run(['--db', db, 'add', '7203'])).json.error.code).toBe('already_watched')
    expect((await run(['--db', db, 'add', '9999'])).json.error.code).toBe('name_required')
    expect((await run(['--db', db, 'add', '9999', '--name', '手入力'])).code).toBe(0)
    expect((await run(['--db', db, 'remove', '7203'])).code).toBe(0)
    expect((await run(['--db', db, 'remove', '7203'])).json.error.code).toBe('not_watched')
    expect((await run(['--db', db, 'add', '12'])).code).toBe(2)
  })
})
