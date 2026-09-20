import { describe, expect, it } from 'vitest'
import { describeCriteria } from '../src/pages/screener/lib/presets.ts'

describe('describeCriteria', () => {
  it('value プリセットの条件を言葉にする', () => {
    const json = JSON.stringify({
      segments: ['prime', 'standard'],
      sectors: [],
      sort: 'dividendYield',
      limit: 50,
      perMax: 12,
      pbrMax: 1,
      dividendMin: 3,
      marketCapMin: 30000000000,
    })
    expect(describeCriteria(json)).toEqual([
      'プライム・スタンダード',
      'PER ≤ 12 倍',
      'PBR ≤ 1.0 倍',
      '配当利回り ≥ 3.0%',
      '時価総額 ≥ 300 億円',
      '配当利回りの高い順',
      '上位 50 件',
    ])
  })
  it('読めない JSON はそのまま返す', () => {
    expect(describeCriteria('{oops')).toEqual(['{oops'])
  })
})
