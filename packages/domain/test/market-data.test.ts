import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import {
  financialHistory,
  latestFundamentals,
  recentDisclosures,
  recentNews,
} from '../src/index.ts'
import { NOW, seedHoldings } from './fixtures.ts'

describe('market-data reads', () => {
  it('ニュース・開示は新しい順、指標は最新、財務は期の新しい順', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    const id = 'JP:1234'
    handle.db
      .insert(schema.newsItems)
      .values([
        {
          instrumentId: id,
          publishedAt: '2026-01-01T09:00:00+09:00',
          title: 'old',
          url: 'u1',
          source: 's',
          fetchedAt: NOW,
        },
        {
          instrumentId: id,
          publishedAt: '2026-01-02T09:00:00+09:00',
          title: 'new',
          url: 'u2',
          source: 's',
          fetchedAt: NOW,
        },
      ])
      .run()
    handle.db
      .insert(schema.disclosures)
      .values([
        {
          instrumentId: id,
          disclosedAt: '2026-01-01T15:00:00+09:00',
          title: 'd1',
          pdfUrl: 'p1',
          category: 'other',
          hasXbrl: 0,
          source: 's',
          fetchedAt: NOW,
        },
        {
          instrumentId: id,
          disclosedAt: '2026-01-03T15:00:00+09:00',
          title: 'd2',
          pdfUrl: 'p2',
          category: 'earnings',
          hasXbrl: 1,
          source: 's',
          fetchedAt: NOW,
        },
      ])
      .run()
    handle.db
      .insert(schema.fundamentals)
      .values([
        { instrumentId: id, asOf: '2026-01-01', per: 10, source: 's', fetchedAt: NOW },
        { instrumentId: id, asOf: '2026-01-02', per: 11, source: 's', fetchedAt: NOW },
      ])
      .run()
    handle.db
      .insert(schema.financials)
      .values([
        {
          instrumentId: id,
          periodType: 'annual',
          periodEnd: '2025-03-31',
          source: 's',
          revenue: 1,
          fetchedAt: NOW,
        },
        {
          instrumentId: id,
          periodType: 'annual',
          periodEnd: '2026-03-31',
          source: 's',
          revenue: 2,
          fetchedAt: NOW,
        },
        {
          instrumentId: id,
          periodType: 'quarterly',
          periodEnd: '2026-06-30',
          source: 's',
          revenue: 3,
          fetchedAt: NOW,
        },
      ])
      .run()
    expect(recentNews(handle.db, id).map((n) => n.title)).toEqual(['new', 'old'])
    expect(recentNews(handle.db, id, 1)).toHaveLength(1)
    expect(recentDisclosures(handle.db, id).map((d) => d.title)).toEqual(['d2', 'd1'])
    expect(latestFundamentals(handle.db, id)?.per).toBe(11)
    expect(financialHistory(handle.db, id).map((f) => f.revenue)).toEqual([2, 1])
    expect(financialHistory(handle.db, id, 'quarterly').map((f) => f.revenue)).toEqual([3])
    expect(recentNews(handle.db, 'JP:5678')).toEqual([])
    handle.close()
  })
})
