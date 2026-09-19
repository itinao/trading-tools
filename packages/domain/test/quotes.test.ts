import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import { latestQuoteDate, latestQuotes, quoteHistory } from '../src/index.ts'
import { seedHoldings, seedQuotes } from './fixtures.ts'

describe('quotes', () => {
  it('quoteHistory は as_of 以前を新しい順に返す', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    seedQuotes(handle, 'JP:1234', [
      ['2026-01-01', 1],
      ['2026-01-02', 2],
      ['2026-01-03', 3],
    ])
    expect(quoteHistory(handle.db, 'JP:1234', { upTo: '2026-01-02' }).map((q) => q.price)).toEqual([
      2, 1,
    ])
    expect(quoteHistory(handle.db, 'JP:1234', { limit: 1 }).map((q) => q.price)).toEqual([3])
    handle.close()
  })
  it('latestQuotes / latestQuoteDate', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    seedQuotes(handle, 'JP:1234', [
      ['2026-01-01', 1],
      ['2026-01-03', 3],
    ])
    seedQuotes(handle, 'JP:5678', [['2026-01-02', 7]])
    expect(latestQuoteDate(handle.db)).toBe('2026-01-03')
    const m = latestQuotes(handle.db)
    expect(m.get('JP:1234')?.price).toBe(3)
    expect(m.get('JP:5678')?.price).toBe(7)
    expect(latestQuotes(handle.db, '2026-01-02').get('JP:1234')?.price).toBe(1)
    handle.close()
  })
  it('データがなければ undefined', () => {
    const handle = createTestDatabase()
    expect(latestQuoteDate(handle.db)).toBeUndefined()
    handle.close()
  })
})
