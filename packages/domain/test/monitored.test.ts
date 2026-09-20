import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import {
  addWatch,
  findUniverse,
  getScreenRun,
  listScreenRuns,
  listWatches,
  monitoredInstruments,
  monitoredTargets,
  removeWatch,
  saveScreenRun,
  universeCount,
  universeRows,
  upsertUniverse,
  WatchError,
} from '../src/index.ts'
import { seedHoldings } from './fixtures.ts'

const uni = [
  {
    code: '7203',
    name: 'トヨタ自動車',
    segment: 'prime' as const,
    segmentRaw: 'プライム（内国株式）',
    sector33: '輸送用機器',
    size: 'TOPIX Core30',
    listedAsOf: '2026-08-31',
  },
  {
    code: '9999',
    name: 'スタンダード社',
    segment: 'standard' as const,
    segmentRaw: 'スタンダード（内国株式）',
    sector33: '卸売業',
    size: null,
    listedAsOf: '2026-08-31',
  },
  {
    code: '1306',
    name: 'ETF',
    segment: 'other' as const,
    segmentRaw: 'ETF・ETN',
    sector33: null,
    size: null,
    listedAsOf: '2026-08-31',
  },
]

describe('universe', () => {
  it('upsert と絞り込み', () => {
    const handle = createTestDatabase()
    expect(upsertUniverse(handle.db, uni)).toBe(3)
    upsertUniverse(handle.db, [{ ...uni[0], name: 'トヨタ自動車（改）' } as (typeof uni)[number]])
    expect(universeCount(handle.db)).toBe(3)
    expect(findUniverse(handle.db, '7203')?.name).toBe('トヨタ自動車（改）')
    expect(universeRows(handle.db, { segments: ['prime', 'standard'] }).map((r) => r.code)).toEqual(
      ['7203', '9999'],
    )
    expect(universeRows(handle.db, { segments: ['prime'], sectors: ['卸売業'] })).toEqual([])
    handle.close()
  })
})

describe('watches', () => {
  it('追加・一覧・削除。保有中は already_held、名前が無ければ name_required', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    upsertUniverse(handle.db, uni)
    const w = addWatch(handle.db, '7203', { note: '割安' })
    expect(w).toMatchObject({ instrumentId: 'JP:7203', name: 'トヨタ自動車' })
    expect(() => addWatch(handle.db, '7203')).toThrow(
      expect.objectContaining({ code: 'already_watched' }),
    )
    expect(() => addWatch(handle.db, '1234')).toThrow(
      expect.objectContaining({ code: 'already_held' }),
    )
    expect(() => addWatch(handle.db, '4444')).toThrow(
      expect.objectContaining({ code: 'name_required' }),
    )
    expect(addWatch(handle.db, '4444', { name: '手入力社' }).name).toBe('手入力社')
    const all = monitoredInstruments(handle.db)
    expect(all.map((m) => [m.code, m.context])).toEqual([
      ['1234', 'holding'],
      ['5678', 'holding'],
      ['4444', 'watch'],
      ['7203', 'watch'],
    ])
    expect(listWatches(handle.db).map((m) => m.code)).toEqual(['4444', '7203'])
    expect(monitoredTargets(handle.db)).toHaveLength(4)
    expect(removeWatch(handle.db, '4444')).toEqual({ instrumentId: 'JP:4444', dismissedActions: 0 })
    expect(() => removeWatch(handle.db, '4444')).toThrow(WatchError)
    handle.close()
  })
})

describe('screen runs', () => {
  it('保存と取得', () => {
    const handle = createTestDatabase()
    const id = saveScreenRun(handle.db, {
      preset: 'value',
      criteria: { perMax: 12 },
      universeSize: 100,
      results: [
        {
          code: '7203',
          name: 'トヨタ',
          segment: 'prime',
          sector33: '輸送用機器',
          price: 3000,
          per: 8.6,
          forwardPer: 9.3,
          pbr: 0.96,
          dividendYield: 3.3,
          marketCap: 3.5e13,
          growthYears: 3,
        },
        {
          code: '9999',
          name: 'x',
          segment: 'standard',
          sector33: null,
          price: 100,
          per: null,
          forwardPer: null,
          pbr: 0.5,
          dividendYield: 4,
          marketCap: 1e10,
          growthYears: null,
        },
      ],
    })
    expect(listScreenRuns(handle.db)[0]).toMatchObject({
      id,
      preset: 'value',
      universeSize: 100,
      matched: 2,
    })
    const run = getScreenRun(handle.db, id)
    expect(run?.criteria).toEqual({ perMax: 12 })
    expect(run?.results.map((r) => [r.rank, r.code])).toEqual([
      [1, '7203'],
      [2, '9999'],
    ])
    expect(getScreenRun(handle.db, 99)).toBeUndefined()
    handle.close()
  })
})
