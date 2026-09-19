import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate, openDatabase, schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { importSnapshot, loadRakutenCsv, tool } from '../src/tool.ts'

const FIXTURE = join(import.meta.dirname, 'fixtures', 'assetbalance(all)_20260101_120000.csv')
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'import-holdings-'))
  dirs.push(dir)
  const path = join(dir, 'test.db')
  const handle = openDatabase(path)
  migrate(handle)
  handle.close()
  return { dir, path }
}

async function run(argv: string[]) {
  const out: string[] = []
  const code = await tool.run(argv, { stdout: (t) => void out.push(t), stderr: () => {}, env: {} })
  return { code, json: JSON.parse(out.join('')) }
}

describe('importSnapshot', () => {
  it('銘柄・スナップショット・保有を1トランザクションで書く', () => {
    const handle = createTestDatabase()
    const loaded = loadRakutenCsv(FIXTURE)
    const result = importSnapshot(handle, { ...loaded, replace: false })
    expect(result).toEqual({ snapshotId: 1, imported: 3, instrumentsCreated: 2 })
    expect(
      handle.db
        .select()
        .from(schema.instruments)
        .all()
        .map((i) => i.id)
        .sort(),
    ).toEqual(['JP:1234', 'JP:5678'])
    expect(handle.db.select().from(schema.holdings).all()).toHaveLength(3)
    handle.close()
  })

  it('同じ as_of は already_imported。--replace で入れ直すと holdings も消える', () => {
    const handle = createTestDatabase()
    const loaded = loadRakutenCsv(FIXTURE)
    importSnapshot(handle, { ...loaded, replace: false })
    expect(() => importSnapshot(handle, { ...loaded, replace: false })).toThrow(
      expect.objectContaining({ code: 'already_imported' }),
    )
    const second = importSnapshot(handle, { ...loaded, replace: true })
    expect(second.snapshotId).toBe(2)
    expect(second.instrumentsCreated).toBe(0)
    expect(handle.db.select().from(schema.holdingSnapshots).all()).toHaveLength(1)
    expect(
      handle.db.select().from(schema.holdings).where(eq(schema.holdings.snapshotId, 1)).all(),
    ).toHaveLength(0)
    expect(
      handle.db.select().from(schema.holdings).where(eq(schema.holdings.snapshotId, 2)).all(),
    ).toHaveLength(3)
    handle.close()
  })

  it('既存銘柄は名前を更新する', () => {
    const handle = createTestDatabase()
    handle.db
      .insert(schema.instruments)
      .values({
        id: 'JP:1234',
        market: 'JP',
        code: '1234',
        name: '旧名',
        createdAt: 'x',
        updatedAt: 'x',
      })
      .run()
    importSnapshot(handle, { ...loadRakutenCsv(FIXTURE), replace: false })
    const row = handle.db
      .select()
      .from(schema.instruments)
      .where(eq(schema.instruments.id, 'JP:1234'))
      .get()
    expect(row?.name).toBe('テスト製作所')
    handle.close()
  })
})

describe('import-holdings CLI', () => {
  it('run は件数と skipped を返し、list に出る', async () => {
    const { path } = tempDb()
    const r = await run(['--db', path, 'run', FIXTURE])
    expect(r.code).toBe(0)
    expect(r.json.data).toEqual({
      snapshotId: 1,
      asOf: '2026-01-01T12:00:00+09:00',
      fileName: 'assetbalance(all)_20260101_120000.csv',
      skipped: { 米国株式: 1, 投資信託: 1 },
      imported: 3,
      instrumentsCreated: 2,
    })
    const list = await run(['--db', path, 'list'])
    expect(list.json.data).toHaveLength(1)
    expect(list.json.data[0]).toMatchObject({ id: 1, rowCount: 3 })
  })

  it('--dry-run は書かない', async () => {
    const { path } = tempDb()
    const r = await run(['--db', path, '--dry-run', 'run', FIXTURE])
    expect(r.json.data.dryRun).toBe(true)
    expect((await run(['--db', path, 'list'])).json.data).toEqual([])
  })

  it('再取り込みは終了コード 1 と already_imported', async () => {
    const { path } = tempDb()
    await run(['--db', path, 'run', FIXTURE])
    const r = await run(['--db', path, 'run', FIXTURE])
    expect(r.code).toBe(1)
    expect(r.json.error.code).toBe('already_imported')
  })

  it('ファイル名が違えば bad_filename', async () => {
    const { dir, path } = tempDb()
    const bad = join(dir, 'holdings.csv')
    copyFileSync(FIXTURE, bad)
    const r = await run(['--db', path, 'run', bad])
    expect(r.code).toBe(1)
    expect(r.json.error.code).toBe('bad_filename')
  })

  it('存在しないファイルは file_not_found', async () => {
    const { path } = tempDb()
    const r = await run(['--db', path, 'run', '/nope/assetbalance(all)_20260101_120000.csv'])
    expect(r.json.error.code).toBe('file_not_found')
  })
})
