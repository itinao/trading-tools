import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import { holdingTargets, positions } from '../src/index.ts'
import { seedHoldings } from './fixtures.ts'

describe('positions', () => {
  it('最新スナップショットを銘柄単位に束ね、取得単価は数量加重平均', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    const ps = positions(handle.db)
    expect(ps.map((p) => p.code)).toEqual(['1234', '5678'])
    const a = ps[0]
    expect(a).toMatchObject({
      instrumentId: 'JP:1234',
      name: 'A',
      quantity: 400,
      marketValue: 1_000_000,
    })
    // (100*2000 + 300*3000) / 400 = 2750
    expect(a?.averageCost).toBe(2750)
    expect(a?.accounts.map((x) => x.account)).toEqual(['旧NISA', '特定'])
    handle.close()
  })
  it('スナップショットがなければ空', () => {
    const handle = createTestDatabase()
    expect(positions(handle.db)).toEqual([])
    expect(holdingTargets(handle.db)).toEqual([])
    handle.close()
  })
})
