import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import {
  history,
  recordAdvice,
  setActionStatus,
  sparklineData,
  timeline,
  upsertScore,
} from '../src/index.ts'
import { NOW, seedHoldings, seedQuotes } from './fixtures.ts'

function seedEvents(handle: ReturnType<typeof createTestDatabase>) {
  seedHoldings(handle)
  seedQuotes(handle, 'JP:1234', [
    ['2026-01-02', 100],
    ['2026-01-05', 90],
    ['2026-01-06', 80],
    ['2026-01-07', 88],
  ])
  const sig = handle.db
    .insert(schema.signals)
    .values({
      instrumentId: 'JP:1234',
      kind: 'drawdown_60d',
      asOf: '2026-01-06',
      severity: 'warn',
      value: -20,
      detailsJson: '{}',
      createdAt: '2026-01-06T18:00:00+09:00',
      updatedAt: NOW,
    })
    .returning({ id: schema.signals.id })
    .get()?.id as number
  const actionId = handle.db
    .insert(schema.actions)
    .values({
      instrumentId: 'JP:1234',
      signalId: sig,
      origin: 'rule',
      title: 'A: 直近高値から -20%',
      body: '',
      status: 'open',
      createdAt: '2026-01-06T18:00:00+09:00',
    })
    .returning({ id: schema.actions.id })
    .get()?.id as number
  recordAdvice(handle.db, [
    {
      actionId,
      stance: 'reduce',
      title: '縮小を検討',
      body: 'x',
      references: [{ type: 'signal', label: 's' }],
    },
  ])
  handle.db
    .insert(schema.newsItems)
    .values({
      instrumentId: 'JP:1234',
      publishedAt: '2026-01-05T09:00:00+09:00',
      title: '不祥事',
      url: 'u',
      source: 's',
      fetchedAt: NOW,
    })
    .run()
  handle.db
    .insert(schema.assessments)
    .values({
      subjectType: 'news',
      subjectId: 1,
      instrumentId: 'JP:1234',
      relevance: 'relevant',
      sentiment: -2,
      impact: 3,
      summary: '大型の不祥事',
      rationale: 'r',
      author: 'ai',
      createdAt: NOW,
    })
    .run()
  upsertScore(handle.db, 'JP:1234', '2026-01-05', -30, {
    assessment: -30,
    price: 0,
    financials: 0,
    notes: [],
  })
  upsertScore(handle.db, 'JP:1234', '2026-01-06', -35, {
    assessment: -30,
    price: -5,
    financials: 0,
    notes: [],
  }) // 同じ週 → 出ない
  return actionId
}

describe('timeline', () => {
  it('出来事を新しい順に、その日の株価と今との差つきで並べる', () => {
    const handle = createTestDatabase()
    const actionId = seedEvents(handle)
    setActionStatus(handle.db, actionId, 'done', '売った')
    const { events, latestPrice } = timeline(handle.db, 'JP:1234')
    expect(latestPrice).toBe(88)
    // 新しい順に並ぶ。対応した（今日）→ 助言・アクション作成・シグナル（1/6）→ 判定・スコア（1/5）
    const ats = events.map((e) => e.at)
    expect([...ats].sort((a, b) => b.localeCompare(a))).toEqual(ats)
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['action', 'advice', 'signal', 'assessment', 'score']),
    )
    const sig = events.find((e) => e.type === 'signal')
    expect(sig).toMatchObject({ priceAt: 80, changeSince: 10 })
    const resolved = events.find((e) => e.type === 'action' && e.detail === '対応した')
    expect(resolved?.meta).toMatchObject({ status: 'done', note: '売った' })
    expect(events.filter((e) => e.type === 'score')).toHaveLength(1)
    expect(events.find((e) => e.type === 'advice')?.meta).toMatchObject({ stance: 'reduce' })
    handle.close()
  })
  it('--days で期間を絞る', () => {
    const handle = createTestDatabase()
    seedEvents(handle)
    expect(
      timeline(handle.db, 'JP:1234', { days: 1 }).events.every((e) => e.at >= '2026-01-06'),
    ).toBe(true)
    handle.close()
  })
  it('保有数量の変化を出す', () => {
    const handle = createTestDatabase()
    seedHoldings(handle) // older: 5678 ×1、latest: 5678 ×10 → 買い増し
    const { events } = timeline(handle.db, 'JP:5678')
    expect(events.find((e) => e.type === 'holding')).toMatchObject({
      title: '買い増し +9 株',
      meta: { from: 1, to: 10 },
    })
    handle.close()
  })
})

describe('history', () => {
  it('対応済み・見送りの一覧と stance × 判断の集計', () => {
    const handle = createTestDatabase()
    const actionId = seedEvents(handle)
    expect(history(handle.db).rows).toEqual([])
    setActionStatus(handle.db, actionId, 'done', '売った')
    const h = history(handle.db)
    expect(h.rows).toHaveLength(1)
    expect(h.rows[0]).toMatchObject({
      code: '1234',
      kind: 'drawdown_60d',
      offense: false,
      stance: 'reduce',
      status: 'done',
      note: '売った',
      priceNow: 88,
    })
    expect(h.summary).toEqual([
      {
        key: 'reduce:done',
        stance: 'reduce',
        status: 'done',
        count: 1,
        medianChange: h.rows[0]?.changeSince,
      },
    ])
    expect(history(handle.db, { since: '2099-01-01' }).rows).toEqual([])
    handle.close()
  })
})

describe('sparklineData', () => {
  it('株価は古い順、アクションの日に印', () => {
    const handle = createTestDatabase()
    seedEvents(handle)
    const s = sparklineData(handle.db, 'JP:1234')
    expect(s.price.map((p) => p.x)).toEqual([
      '2026-01-02',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
    ])
    expect(s.price.find((p) => p.x === '2026-01-06')?.mark).toBe(true)
    expect(s.score).toHaveLength(2)
    handle.close()
  })
})
