import { createTestDatabase } from '@trading/db/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { closeMcpDatabase } from '../src/lib/db.ts'
import { readTools } from '../src/tools/read.ts'
import { writeTools } from '../src/tools/write.ts'

/** ツールの入出力（Design Doc 0018）。DB はメモリに作り、domain 経由で書いた事実を読み返す */

const universeRow = (code: string, name: string) => ({
  code,
  name,
  segment: 'prime' as const,
  segmentRaw: 'プライム',
  sector33: null,
  size: null,
  listedAsOf: '2026-09-01',
})

interface InstrumentsList {
  holdings: { code: string }[]
  watches: { code: string }[]
}
const listed = (context: string) =>
  tool('instruments_list').handler({ context }).structuredContent as unknown as InstrumentsList

const tool = (name: string) =>
  [...readTools, ...writeTools].find((t) => t.name === name) ?? expect.fail(`${name} が無い`)

describe('mcp のツール', () => {
  beforeEach(async () => {
    closeMcpDatabase()
    const handle = createTestDatabase()
    const { setHandleForTest } = await import('../src/lib/db.ts')
    setHandleForTest(handle)
  })

  it('読み取りのツールに重複した名前が無い', () => {
    const names = [...readTools, ...writeTools].map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('ツールには説明と入力スキーマがある', () => {
    for (const t of [...readTools, ...writeTools]) {
      expect(t.description.length, t.name).toBeGreaterThan(10)
      expect(t.inputSchema, t.name).toBeTypeOf('object')
    }
  })

  it('actions_today は空の DB でも状態を返す', () => {
    const r = tool('actions_today').handler({ status: 'open' })
    expect(r.structuredContent).toMatchObject({
      status: { openActions: { total: 0 } },
      actions: [],
    })
    // content には JSON がそのまま入る（クライアントが読み上げる用）
    expect(JSON.parse(r.content[0]?.text as string)).toEqual(r.structuredContent)
  })

  it('instruments_list は保有とウォッチを分けて返す', async () => {
    const { addWatch, upsertUniverse } = await import('@trading/domain')
    const { db } = await import('../src/lib/db.ts')
    upsertUniverse(db(), [universeRow('7203', 'トヨタ自動車')])
    addWatch(db(), '7203', { note: 'test' })
    const r = listed('all')
    expect(r.holdings).toEqual([])
    expect(r.watches[0]?.code).toBe('7203')
  })

  it('instrument_overview は未登録の銘柄で失敗する', () => {
    expect(() => tool('instrument_overview').handler({ code: '9999' })).toThrow(
      '登録されていません',
    )
  })

  it('instrument_overview は証券コードを検証する', () => {
    expect(() => tool('instrument_overview').handler({ code: 'abc' })).toThrow('証券コードは 4 桁')
  })

  it('watch_add と watch_remove が往復する', async () => {
    const { upsertUniverse } = await import('@trading/domain')
    const { db } = await import('../src/lib/db.ts')
    upsertUniverse(db(), [universeRow('6758', 'ソニーグループ')])
    tool('watch_add').handler({ code: '6758', note: 'mcp から' })
    expect(listed('watch').watches.map((w) => w.code)).toEqual(['6758'])
    tool('watch_remove').handler({ code: '6758' })
    expect(listed('watch').watches).toEqual([])
  })

  it('action_resolve は無いアクションで失敗する', () => {
    expect(() => tool('action_resolve').handler({ id: 999, status: 'done' })).toThrow('ありません')
  })
})
