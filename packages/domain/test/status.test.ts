import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import { addWatch, dashboardStatus } from '../src/index.ts'
import { NOW, seedHoldings, seedQuotes } from './fixtures.ts'

describe('dashboardStatus', () => {
  it('未対応の件数を保有 / ウォッチで分け、未判定と鮮度を返す', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    addWatch(handle.db, '7203', { name: 'トヨタ' })
    seedQuotes(handle, 'JP:1234', [['2026-01-05', 1]])
    const a = (instrumentId: string, status: string) =>
      handle.db
        .insert(schema.actions)
        .values({
          instrumentId,
          signalId: null,
          origin: 'rule',
          title: 't',
          body: '',
          status,
          createdAt: NOW,
        })
        .run()
    a('JP:1234', 'open')
    a('JP:1234', 'open')
    a('JP:7203', 'open')
    a('JP:5678', 'done')
    handle.db
      .insert(schema.newsItems)
      .values([
        {
          instrumentId: 'JP:1234',
          publishedAt: NOW,
          title: 'n',
          url: 'u',
          source: 's',
          fetchedAt: NOW,
        },
        {
          instrumentId: 'JP:7203',
          publishedAt: NOW,
          title: 'n2',
          url: 'u2',
          source: 's',
          fetchedAt: NOW,
        },
      ])
      .run()
    expect(dashboardStatus(handle.db)).toEqual({
      latestQuoteDate: '2026-01-05',
      openActions: { holding: 2, watch: 1, total: 3 },
      pendingAssessments: 2,
      monitored: { holding: 2, watch: 1 },
    })
    handle.close()
  })
})
