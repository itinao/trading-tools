import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate, openDatabase, schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { buildPending, parseRecordInput, tool } from '../src/tool.ts'

const NOW = '2026-01-01T00:00:00+09:00'
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function seed(db: ReturnType<typeof openDatabase>['db']) {
  db.insert(schema.instruments)
    .values({
      id: 'JP:1234',
      market: 'JP',
      code: '1234',
      name: 'テスト製作所',
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run()
  const snap = db
    .insert(schema.holdingSnapshots)
    .values({
      source: 'rakuten',
      asOf: NOW,
      fileName: 'x',
      importedAt: NOW,
      rowCount: 1,
      skippedJson: '{}',
    })
    .returning({ id: schema.holdingSnapshots.id })
    .get()?.id as number
  db.insert(schema.holdings)
    .values({
      snapshotId: snap,
      instrumentId: 'JP:1234',
      account: '特定',
      quantity: 1,
      averageCost: 1,
      priceAtSnapshot: 1,
      marketValue: 1,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
    })
    .run()
  db.insert(schema.newsItems)
    .values({
      instrumentId: 'JP:1234',
      publishedAt: '2026-01-02T09:00:00+09:00',
      title: 'n1',
      url: 'u1',
      source: 's',
      fetchedAt: NOW,
    })
    .run()
  db.insert(schema.disclosures)
    .values({
      instrumentId: 'JP:1234',
      disclosedAt: '2026-01-02T15:00:00+09:00',
      title: 'd1',
      pdfUrl: 'https://t/1.pdf',
      category: 'forecast_revision',
      hasXbrl: 0,
      source: 's',
      fetchedAt: NOW,
    })
    .run()
}

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'assess-'))
  dirs.push(dir)
  const path = join(dir, 'test.db')
  const handle = openDatabase(path)
  migrate(handle)
  seed(handle.db)
  handle.close()
  return { dir, path }
}

async function run(argv: string[], stdin = '') {
  const out: string[] = []
  const code = await tool.run(argv, {
    stdout: (t) => void out.push(t),
    stderr: () => {},
    stdin: () => stdin,
    env: {},
  })
  return { code, json: JSON.parse(out.join('')) }
}

describe('buildPending', () => {
  it('開示には PDF 本文を同梱し、取れなければ textError', async () => {
    const handle = createTestDatabase()
    seed(handle.db)
    const ok = await buildPending(handle, { limit: 10 }, async () => ({
      text: '本文',
      pages: 2,
      truncated: false,
    }))
    expect(ok.items.map((i) => i.kind)).toEqual(['disclosure', 'news'])
    expect(ok.items[0]).toMatchObject({ text: '本文', textPages: 2 })
    expect(ok.items[1]).not.toHaveProperty('text')
    const ng = await buildPending(handle, { limit: 10 }, async () => {
      throw new Error('HTTP 404')
    })
    expect(ng.items[0]).toMatchObject({ textError: 'HTTP 404' })
    handle.close()
  })
})

describe('parseRecordInput', () => {
  it('配列でなければ usage、不正な要素があれば invalid_input で全体失敗', () => {
    expect(() => parseRecordInput({})).toThrow(expect.objectContaining({ code: 'usage' }))
    expect(() =>
      parseRecordInput([
        {
          kind: 'news',
          id: 1,
          relevance: 'relevant',
          sentiment: 0,
          impact: 1,
          summary: 's',
          rationale: 'r',
        },
        { kind: 'bogus' },
      ]),
    ).toThrow(expect.objectContaining({ code: 'invalid_input' }))
  })
})

describe('assess CLI', () => {
  it('record → list → override の流れ', async () => {
    const { dir, path } = tempDb()
    const file = join(dir, 'in.json')
    writeFileSync(
      file,
      JSON.stringify([
        {
          kind: 'news',
          id: 1,
          relevance: 'relevant',
          sentiment: -1,
          impact: 2,
          summary: '悪い',
          rationale: '「n1」',
          model: 'test',
        },
      ]),
    )
    const r = await run(['--db', path, '--input', file, 'record'])
    expect(r.code).toBe(0)
    expect(r.json.data).toEqual({ written: 1, ids: [1] })

    const list = await run(['--db', path, 'list', '--instrument', 'JP:1234'])
    expect(list.json.data).toHaveLength(1)
    expect(list.json.data[0]).toMatchObject({ author: 'ai', sentiment: -1 })

    const ov = await run([
      '--db',
      path,
      'override',
      '1',
      '--sentiment',
      '1',
      '--note',
      '見出しだけでは悪材料と言えない',
    ])
    expect(ov.code).toBe(0)
    const after = await run(['--db', path, 'list', '--instrument', 'JP:1234'])
    expect(after.json.data).toHaveLength(1)
    expect(after.json.data[0]).toMatchObject({
      author: 'human',
      sentiment: 1,
      impact: 2,
      note: '見出しだけでは悪材料と言えない',
    })

    expect((await run(['--db', path, 'override', '99', '--sentiment', '0'])).json.error.code).toBe(
      'not_found',
    )
    expect((await run(['--db', path, 'override', '1', '--sentiment', '5'])).code).toBe(2)
  })

  it('record は stdin からも読め、存在しない対象は subject_not_found', async () => {
    const { path } = tempDb()
    const r = await run(
      ['--db', path, '--input', '-', 'record'],
      JSON.stringify([
        {
          kind: 'news',
          id: 42,
          relevance: 'relevant',
          sentiment: 0,
          impact: 1,
          summary: 's',
          rationale: 'r',
        },
      ]),
    )
    expect(r.code).toBe(1)
    expect(r.json.error.code).toBe('subject_not_found')
  })

  it('pending の --limit / --kind を検証する', async () => {
    const { path } = tempDb()
    expect((await run(['--db', path, 'pending', '--limit', '0'])).code).toBe(2)
    expect((await run(['--db', path, 'pending', '--kind', 'x'])).code).toBe(2)
    const r = await run(['--db', path, 'pending', '--kind', 'news'])
    expect(r.json.data.items.map((i: { kind: string }) => i.kind)).toEqual(['news'])
  })
})
