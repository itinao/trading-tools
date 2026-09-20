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
  const dir = mkdtempSync(join(tmpdir(), 'advise-'))
  dirs.push(dir)
  const path = join(dir, 'test.db')
  const handle = openDatabase(path)
  migrate(handle)
  const db = handle.db
  db.insert(schema.instruments)
    .values({
      id: 'JP:1234',
      market: 'JP',
      code: '1234',
      name: 'A',
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
      quantity: 100,
      averageCost: 1000,
      priceAtSnapshot: 800,
      marketValue: 80000,
      unrealizedPnl: -20000,
      unrealizedPnlPct: -20,
    })
    .run()
  db.insert(schema.quotes)
    .values({
      instrumentId: 'JP:1234',
      asOf: '2026-01-05',
      price: 800,
      previousClose: null,
      source: 't',
      fetchedAt: NOW,
    })
    .run()
  const sig = db
    .insert(schema.signals)
    .values({
      instrumentId: 'JP:1234',
      kind: 'price_drop_cost',
      asOf: '2026-01-05',
      severity: 'critical',
      value: -20,
      detailsJson: '{}',
      createdAt: NOW,
      updatedAt: NOW,
    })
    .returning({ id: schema.signals.id })
    .get()?.id as number
  const actionId = db
    .insert(schema.actions)
    .values({
      instrumentId: 'JP:1234',
      signalId: sig,
      origin: 'rule',
      title: 'A: 取得単価比 -20%',
      body: '-',
      status: 'open',
      createdAt: NOW,
    })
    .returning({ id: schema.actions.id })
    .get()?.id as number
  handle.close()
  return { path, actionId }
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

describe('advise CLI', () => {
  it('pending → record → pending が空になる。二重付与は already_advised', async () => {
    const { path, actionId } = tempDb()
    const p = await run(['--db', path, 'pending'])
    expect(p.code).toBe(0)
    expect(p.json.data.items).toHaveLength(1)
    expect(p.json.data.items[0].action.id).toBe(actionId)
    expect(p.json.data.items[0].context).toBe('holding')
    expect(p.json.data.items[0].stances).toEqual(['hold', 'review', 'reduce'])
    expect(p.json.data.items[0].quotes.vsAverageCost).toBe(-20)

    const advice = [
      {
        actionId,
        stance: 'review',
        title: 't',
        body: '## 状況\nx',
        references: [{ type: 'signal', id: 1, label: 's' }],
        model: 'test',
      },
    ]
    const r = await run(['--db', path, '--input', '-', 'record'], JSON.stringify(advice))
    expect(r.code).toBe(0)
    expect(r.json.data.written).toBe(1)
    expect((await run(['--db', path, 'pending'])).json.data.items).toHaveLength(0)
    const dup = await run(['--db', path, '--input', '-', 'record'], JSON.stringify(advice))
    expect(dup.code).toBe(1)
    expect(dup.json.error.code).toBe('already_advised')
  })

  it('不正な入力は invalid_input、配列でなければ usage、--dry-run は書かない', async () => {
    const { path, actionId } = tempDb()
    const bad = await run(
      ['--db', path, '--input', '-', 'record'],
      JSON.stringify([{ actionId, stance: 'review', title: 't', body: 'b', references: [] }]),
    )
    expect(bad.json.error.code).toBe('invalid_input')
    expect((await run(['--db', path, '--input', '-', 'record'], '{}')).code).toBe(2)
    const dry = await run(
      ['--db', path, '--dry-run', '--input', '-', 'record'],
      JSON.stringify([
        {
          actionId,
          stance: 'hold',
          title: 't',
          body: 'b',
          references: [{ type: 'quote', label: 'q' }],
        },
      ]),
    )
    expect(dry.json.data).toEqual({ written: 0, valid: 1, dryRun: true })
    expect((await run(['--db', path, 'pending'])).json.data.items).toHaveLength(1)
  })
})
