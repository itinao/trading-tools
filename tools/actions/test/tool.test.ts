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

function seededDb() {
  const dir = mkdtempSync(join(tmpdir(), 'tool-actions-'))
  dirs.push(dir)
  const path = join(dir, 'test.db')
  const handle = openDatabase(path)
  migrate(handle)
  handle.db
    .insert(schema.instruments)
    .values({
      id: 'JP:1234',
      market: 'JP',
      code: '1234',
      name: 'A',
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run()
  handle.db
    .insert(schema.actions)
    .values([
      {
        instrumentId: 'JP:1234',
        signalId: null,
        origin: 'manual',
        title: 'one',
        body: 'b1',
        status: 'open',
        createdAt: NOW,
      },
      {
        instrumentId: 'JP:1234',
        signalId: null,
        origin: 'manual',
        title: 'two',
        body: 'b2',
        status: 'done',
        createdAt: NOW,
        resolvedAt: NOW,
      },
    ])
    .run()
  handle.close()
  return path
}

async function run(argv: string[]) {
  const out: string[] = []
  const code = await tool.run(argv, { stdout: (t) => void out.push(t), stderr: () => {}, env: {} })
  return { code, json: JSON.parse(out.join('')) }
}

describe('actions CLI', () => {
  it('list は既定で open、--status all で全部', async () => {
    const db = seededDb()
    expect(
      (await run(['--db', db, 'list'])).json.data.map((a: { title: string }) => a.title),
    ).toEqual(['one'])
    expect((await run(['--db', db, 'list', '--status', 'all'])).json.data).toHaveLength(2)
    expect((await run(['--db', db, 'list', '--status', 'bogus'])).code).toBe(2)
  })

  it('show は本文を返し、無ければ not_found', async () => {
    const db = seededDb()
    expect((await run(['--db', db, 'show', '1'])).json.data).toMatchObject({
      id: 1,
      title: 'one',
      body: 'b1',
      code: '1234',
    })
    const missing = await run(['--db', db, 'show', '99'])
    expect(missing.code).toBe(1)
    expect(missing.json.error.code).toBe('not_found')
    expect((await run(['--db', db, 'show', 'x'])).code).toBe(2)
  })

  it('resolve は状態を変え、--dry-run は変えない', async () => {
    const db = seededDb()
    const dry = await run(['--db', db, '--dry-run', 'resolve', '1', '--status', 'done'])
    expect(dry.json.data).toEqual({ id: 1, from: 'open', to: 'done', dryRun: true })
    expect((await run(['--db', db, 'show', '1'])).json.data.status).toBe('open')

    const r = await run(['--db', db, 'resolve', '1', '--status', 'done', '--note', '確認'])
    expect(r.code).toBe(0)
    expect(r.json.data).toMatchObject({ id: 1, status: 'done' })
    expect((await run(['--db', db, 'show', '1'])).json.data).toMatchObject({
      status: 'done',
      note: '確認',
    })

    await run(['--db', db, 'resolve', '1', '--status', 'open'])
    expect((await run(['--db', db, 'show', '1'])).json.data).toMatchObject({
      status: 'open',
      resolvedAt: null,
    })
  })

  it('resolve の --status は必須で、値も検証する', async () => {
    const db = seededDb()
    expect((await run(['--db', db, 'resolve', '1'])).code).toBe(2)
    expect((await run(['--db', db, 'resolve', '1', '--status', 'all'])).code).toBe(2)
  })
})
