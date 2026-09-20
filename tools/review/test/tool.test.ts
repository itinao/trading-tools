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
  const dir = mkdtempSync(join(tmpdir(), 'review-'))
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
    .insert(schema.quotes)
    .values({
      instrumentId: 'JP:1234',
      asOf: '2026-01-05',
      price: 100,
      previousClose: null,
      source: 't',
      fetchedAt: NOW,
    })
    .run()
  const sig = handle.db
    .insert(schema.signals)
    .values({
      instrumentId: 'JP:1234',
      kind: 'price_drop_day',
      asOf: '2026-01-05',
      severity: 'warn',
      value: -8,
      detailsJson: '{}',
      createdAt: NOW,
      updatedAt: NOW,
    })
    .returning({ id: schema.signals.id })
    .get()?.id as number
  handle.db
    .insert(schema.actions)
    .values({
      instrumentId: 'JP:1234',
      signalId: sig,
      origin: 'rule',
      title: 't',
      body: '',
      status: 'dismissed',
      note: '様子見',
      createdAt: '2026-01-05T18:00:00+09:00',
      resolvedAt: '2026-01-06T09:00:00+09:00',
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

describe('review CLI', () => {
  it('timeline と history', async () => {
    const db = tempDb()
    const t = await run(['--db', db, 'timeline', '1234', '--days', 'all'])
    expect(t.code).toBe(0)
    expect(t.json.data.instrument).toEqual({ id: 'JP:1234', code: '1234', name: 'A' })
    expect(t.json.data.events.map((e: { type: string }) => e.type)).toEqual([
      'action',
      'action',
      'signal',
    ])
    expect((await run(['--db', db, 'timeline', '9999'])).json.error.code).toBe('not_found')
    expect((await run(['--db', db, 'timeline', '1234', '--days', 'x'])).code).toBe(2)
    const h = await run(['--db', db, 'history'])
    expect(h.json.data.rows).toHaveLength(1)
    expect(h.json.data.rows[0]).toMatchObject({
      code: '1234',
      status: 'dismissed',
      note: '様子見',
      stance: null,
    })
    expect(h.json.data.summary).toEqual([
      { key: 'none:dismissed', stance: 'none', status: 'dismissed', count: 1, medianChange: 0 },
    ])
    expect((await run(['--db', db, 'history', '--since', '2026/01/01'])).code).toBe(2)
  })
})
