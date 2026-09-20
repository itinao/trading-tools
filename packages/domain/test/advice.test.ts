import { schema } from '@trading/db'
import { createTestDatabase } from '@trading/db/testing'
import { describe, expect, it } from 'vitest'
import {
  adviceForActions,
  listActions,
  parseAdviceBody,
  pendingAdvice,
  recordAdvice,
  renderAdviceBody,
  setActionStatus,
  validateAdviceInput,
} from '../src/index.ts'
import { NOW, seedHoldings, seedQuotes } from './fixtures.ts'

function seedRuleAction(handle: ReturnType<typeof createTestDatabase>, instrumentId = 'JP:1234') {
  const sig = handle.db
    .insert(schema.signals)
    .values({
      instrumentId,
      kind: 'price_drop_cost',
      asOf: '2026-01-05',
      severity: 'critical',
      value: -21,
      detailsJson: '{}',
      createdAt: NOW,
      updatedAt: NOW,
    })
    .returning({ id: schema.signals.id })
    .get()?.id as number
  return handle.db
    .insert(schema.actions)
    .values({
      instrumentId,
      signalId: sig,
      origin: 'rule',
      title: 'A: 取得単価比 -21%',
      body: '- 事実',
      status: 'open',
      createdAt: NOW,
    })
    .returning({ id: schema.actions.id })
    .get()?.id as number
}

const input = (actionId: number) => ({
  actionId,
  stance: 'review' as const,
  title: '株価だけが下がっている。決算まで様子見が妥当か確認',
  body: '## 状況\n下落。\n\n## 論点\n固有か市場か。',
  references: [{ type: 'signal' as const, id: 1, label: '取得単価比 -21%' }],
  model: 'test',
})

describe('advice body', () => {
  it('front matter を往復できる', () => {
    const body = renderAdviceBody(
      'reduce',
      [{ type: 'disclosure', id: 3, label: '下方修正', url: 'https://x' }],
      '## 状況\nx',
      'm',
    )
    expect(body.startsWith('---\n')).toBe(true)
    expect(parseAdviceBody(body)).toEqual({
      stance: 'reduce',
      references: [{ type: 'disclosure', id: 3, label: '下方修正', url: 'https://x' }],
      markdown: '## 状況\nx',
      model: 'm',
    })
    expect(parseAdviceBody('plain')).toEqual({
      stance: 'review',
      references: [],
      markdown: 'plain',
      model: null,
    })
  })
})

describe('validateAdviceInput', () => {
  it('references が空なら拒否', () => {
    expect(validateAdviceInput({ ...input(1), references: [] }, 0)).toMatchObject({
      ok: false,
      error: expect.stringContaining('references'),
    })
    expect(validateAdviceInput({ ...input(1), stance: 'sell' }, 2)).toMatchObject({
      ok: false,
      error: expect.stringContaining('[2] stance は'),
    })
    expect(validateAdviceInput(input(1), 0)).toMatchObject({ ok: true })
  })
})

describe('pendingAdvice / recordAdvice / adviceForActions', () => {
  it('事実の束を組み立て、助言を書き、一覧では行の中に付く', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    seedQuotes(handle, 'JP:1234', [
      ['2026-01-04', 2600],
      ['2026-01-05', 2000],
    ])
    const ruleId = seedRuleAction(handle)
    const p = pendingAdvice(handle.db)
    expect(p.remaining).toBe(0)
    expect(p.items).toHaveLength(1)
    const b = p.items[0]
    expect(b?.action.id).toBe(ruleId)
    expect(b?.instrument.position?.quantity).toBe(400)
    expect(b?.quotes.price).toBe(2000)
    expect(b?.quotes.vsAverageCost).toBeCloseTo(-27.27, 1)
    expect(b?.signals).toHaveLength(1)
    expect(b?.history).toEqual([])

    const r = recordAdvice(handle.db, [input(ruleId)])
    expect(r.written).toBe(1)
    // 二重付与は失敗
    expect(() => recordAdvice(handle.db, [input(ruleId)])).toThrow(
      expect.objectContaining({ code: 'already_advised' }),
    )
    expect(pendingAdvice(handle.db).items).toHaveLength(0)

    // 一覧には ai の行は出ず、adviceForActions で行に付く
    const list = listActions(handle.db, { status: 'open' })
    expect(list).toHaveLength(1)
    const advice = adviceForActions(handle.db, list)
    expect(advice.get(ruleId)).toMatchObject({
      stance: 'review',
      title: input(ruleId).title,
      references: input(ruleId).references,
      model: 'test',
    })
    expect(listActions(handle.db, { status: 'open', includeAdvice: true })).toHaveLength(2)

    // 状態の連動
    setActionStatus(handle.db, ruleId, 'done')
    const all = handle.db.select().from(schema.actions).all()
    expect(all.map((a) => a.status)).toEqual(['done', 'done'])
    expect(() => recordAdvice(handle.db, [input(ruleId)])).toThrow(
      expect.objectContaining({ code: 'not_open' }),
    )
    handle.close()
  })

  it('存在しない・シグナル無しは失敗', () => {
    const handle = createTestDatabase()
    seedHoldings(handle)
    expect(() => recordAdvice(handle.db, [input(99)])).toThrow(
      expect.objectContaining({ code: 'not_found' }),
    )
    const manual = handle.db
      .insert(schema.actions)
      .values({
        instrumentId: 'JP:1234',
        signalId: null,
        origin: 'manual',
        title: 'm',
        body: '',
        status: 'open',
        createdAt: NOW,
      })
      .returning({ id: schema.actions.id })
      .get()?.id as number
    expect(() => recordAdvice(handle.db, [input(manual)])).toThrow(
      expect.objectContaining({ code: 'no_signal' }),
    )
    handle.close()
  })
})
