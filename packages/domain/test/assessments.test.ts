import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import {
  effectiveAssessments,
  latestScores,
  pendingSubjects,
  recordAssessments,
  scoreHistory,
  upsertScore,
  validateAssessmentInput,
} from '../src/index.ts'
import { NOW, seedHoldings } from './fixtures.ts'

function seedSubjects(handle: ReturnType<typeof createTestDatabase>) {
  handle.db
    .insert(schema.newsItems)
    .values([
      {
        instrumentId: 'JP:1234',
        publishedAt: '2026-01-01T09:00:00+09:00',
        title: 'n-old',
        url: 'u1',
        source: 's',
        fetchedAt: NOW,
      },
      {
        instrumentId: 'JP:1234',
        publishedAt: '2026-01-03T09:00:00+09:00',
        title: 'n-new',
        url: 'u2',
        source: 's',
        fetchedAt: NOW,
      },
      {
        instrumentId: 'JP:5678',
        publishedAt: '2026-01-02T09:00:00+09:00',
        title: 'n-b',
        url: 'u3',
        source: 's',
        fetchedAt: NOW,
      },
    ])
    .run()
  handle.db
    .insert(schema.disclosures)
    .values([
      {
        instrumentId: 'JP:1234',
        disclosedAt: '2026-01-02T15:00:00+09:00',
        title: 'd1',
        pdfUrl: 'p1',
        category: 'forecast_revision',
        hasXbrl: 1,
        source: 's',
        fetchedAt: NOW,
      },
    ])
    .run()
}

describe('pendingSubjects', () => {
  it('開示を先に、ニュースは新しい順。判定済みは除く。limit と remaining', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    seedSubjects(handle)
    const all = pendingSubjects(handle.db)
    expect(all.items.map((i) => `${i.kind}:${i.title}`)).toEqual([
      'disclosure:d1',
      'news:n-new',
      'news:n-b',
      'news:n-old',
    ])
    expect(all.remaining).toBe(0)
    recordAssessments(handle.db, [
      {
        kind: 'disclosure',
        id: 1,
        relevance: 'relevant',
        sentiment: -2,
        impact: 3,
        direction: 'down',
        summary: 's',
        rationale: 'r',
        author: 'ai',
      },
    ])
    const rest = pendingSubjects(handle.db, { limit: 2 })
    expect(rest.items.map((i) => i.title)).toEqual(['n-new', 'n-b'])
    expect(rest.remaining).toBe(1)
    expect(pendingSubjects(handle.db, { kind: 'disclosure' }).items).toEqual([])
    handle.close()
  })
})

describe('validateAssessmentInput', () => {
  it('形式を検証する', () => {
    const ok = validateAssessmentInput(
      {
        kind: 'news',
        id: 1,
        relevance: 'relevant',
        sentiment: 1,
        impact: 2,
        summary: 's',
        rationale: 'r',
      },
      0,
    )
    expect(ok).toMatchObject({ ok: true, value: { author: 'ai' } })
    expect(validateAssessmentInput({ kind: 'x' }, 3)).toMatchObject({
      ok: false,
      error: '[3] kind は news | disclosure',
    })
    expect(
      validateAssessmentInput(
        {
          kind: 'news',
          id: 1,
          relevance: 'relevant',
          sentiment: 3,
          impact: 2,
          summary: 's',
          rationale: 'r',
        },
        0,
      ),
    ).toMatchObject({ ok: false })
    expect(
      validateAssessmentInput(
        {
          kind: 'news',
          id: 1,
          relevance: 'relevant',
          sentiment: 0,
          impact: 1,
          summary: 's',
          rationale: '',
        },
        0,
      ),
    ).toMatchObject({ ok: false })
  })
})

describe('recordAssessments / effectiveAssessments', () => {
  it('human を優先し、ai は残る。存在しない対象は失敗', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    seedSubjects(handle)
    recordAssessments(handle.db, [
      {
        kind: 'news',
        id: 1,
        relevance: 'relevant',
        sentiment: -1,
        impact: 2,
        summary: 'ai',
        rationale: 'r',
        author: 'ai',
        model: 'm',
      },
      {
        kind: 'news',
        id: 3,
        relevance: 'irrelevant',
        sentiment: 0,
        impact: 1,
        summary: 'ai',
        rationale: 'r',
        author: 'ai',
      },
    ])
    recordAssessments(handle.db, [
      {
        kind: 'news',
        id: 1,
        relevance: 'relevant',
        sentiment: 2,
        impact: 1,
        summary: 'human',
        rationale: 'r',
        author: 'human',
        note: '違う',
      },
    ])
    const eff = effectiveAssessments(handle.db, { instrumentId: 'JP:1234' })
    expect(eff).toHaveLength(1)
    expect(eff[0]).toMatchObject({ author: 'human', sentiment: 2, note: '違う' })
    expect(handle.db.select().from(schema.assessments).all()).toHaveLength(3)
    // ai の再記録は上書き
    recordAssessments(handle.db, [
      {
        kind: 'news',
        id: 3,
        relevance: 'relevant',
        sentiment: 1,
        impact: 1,
        summary: 'ai2',
        rationale: 'r',
        author: 'ai',
      },
    ])
    expect(effectiveAssessments(handle.db, { instrumentId: 'JP:5678' })[0]).toMatchObject({
      summary: 'ai2',
    })
    expect(() =>
      recordAssessments(handle.db, [
        {
          kind: 'news',
          id: 99,
          relevance: 'relevant',
          sentiment: 0,
          impact: 1,
          summary: 's',
          rationale: 'r',
          author: 'ai',
        },
      ]),
    ).toThrow(/99/)
    handle.close()
  })
})

describe('scores', () => {
  it('upsert と最新・履歴', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    const c = { assessment: 0, price: -10, financials: 0, notes: [] }
    upsertScore(handle.db, 'JP:1234', '2026-01-01', -10, c)
    upsertScore(handle.db, 'JP:1234', '2026-01-02', -20, c)
    upsertScore(handle.db, 'JP:1234', '2026-01-02', -25, c)
    expect(latestScores(handle.db).get('JP:1234')).toMatchObject({ asOf: '2026-01-02', score: -25 })
    expect(scoreHistory(handle.db, 'JP:1234').map((s) => s.score)).toEqual([-25, -10])
    handle.close()
  })
})
