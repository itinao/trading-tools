import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import { getAction, listActions, setActionStatus } from '../src/index.ts'
import { NOW, seedHoldings } from './fixtures.ts'

function seedActions(handle: ReturnType<typeof createTestDatabase>) {
  const sig = (instrumentId: string, kind: string, severity: string) =>
    handle.db
      .insert(schema.signals)
      .values({
        instrumentId,
        kind,
        asOf: '2026-01-05',
        severity,
        value: -12,
        detailsJson: '{}',
        createdAt: NOW,
        updatedAt: NOW,
      })
      .returning({ id: schema.signals.id })
      .get()?.id as number
  const warn = sig('JP:1234', 'price_drop_cost', 'warn')
  const crit = sig('JP:5678', 'drawdown_60d', 'critical')
  handle.db
    .insert(schema.actions)
    .values([
      {
        instrumentId: 'JP:1234',
        signalId: warn,
        origin: 'rule',
        title: 'w',
        body: '',
        status: 'open',
        createdAt: '2026-01-05T10:00:00+09:00',
      },
      {
        instrumentId: 'JP:5678',
        signalId: crit,
        origin: 'rule',
        title: 'c',
        body: '',
        status: 'open',
        createdAt: '2026-01-04T10:00:00+09:00',
      },
      {
        instrumentId: 'JP:5678',
        signalId: null,
        origin: 'manual',
        title: 'm',
        body: '',
        status: 'done',
        createdAt: '2026-01-03T10:00:00+09:00',
        resolvedAt: NOW,
      },
    ])
    .run()
}

describe('actions', () => {
  it('listActions は重大度 → 新しい順、status で絞れる', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    seedActions(handle)
    expect(listActions(handle.db).map((a) => a.title)).toEqual(['c', 'w', 'm'])
    expect(listActions(handle.db, { status: 'open' }).map((a) => a.title)).toEqual(['c', 'w'])
    expect(listActions(handle.db, { instrumentId: 'JP:5678' }).map((a) => a.title)).toEqual([
      'c',
      'm',
    ])
    const c = listActions(handle.db)[0]
    expect(c).toMatchObject({
      code: '5678',
      name: 'B',
      kind: 'drawdown_60d',
      severity: 'critical',
      value: -12,
    })
    handle.close()
  })

  it('setActionStatus は resolved_at を更新し、open に戻すと NULL', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    seedActions(handle)
    const id = listActions(handle.db, { status: 'open' })[0]?.id as number
    const r = setActionStatus(handle.db, id, 'done', '確認した')
    expect(r?.status).toBe('done')
    expect(r?.resolvedAt).toMatch(/^\d{4}-/)
    expect(getAction(handle.db, id)).toMatchObject({ status: 'done', note: '確認した' })
    setActionStatus(handle.db, id, 'open')
    expect(getAction(handle.db, id)).toMatchObject({
      status: 'open',
      resolvedAt: null,
      note: '確認した',
    })
    expect(setActionStatus(handle.db, 9999, 'done')).toBeUndefined()
    handle.close()
  })
})
