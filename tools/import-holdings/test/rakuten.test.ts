import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  asOfFromFileName,
  decodeShiftJis,
  parseRakutenHoldings,
  RakutenFormatError,
} from '../src/rakuten.ts'

const FIXTURE = join(import.meta.dirname, 'fixtures', 'assetbalance(all)_20260101_120000.csv')
const text = () => decodeShiftJis(readFileSync(FIXTURE))

describe('asOfFromFileName', () => {
  it('ファイル名の日時を +09:00 の ISO にする', () => {
    expect(asOfFromFileName(FIXTURE)).toBe('2026-01-01T12:00:00+09:00')
  })
  it('形式が違えば undefined', () => {
    expect(asOfFromFileName('holdings.csv')).toBeUndefined()
  })
})

describe('parseRakutenHoldings', () => {
  it('国内株式だけを取り出し、他は種別ごとに数える', () => {
    const result = parseRakutenHoldings(text())
    expect(result.skipped).toEqual({ 米国株式: 1, 投資信託: 1 })
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0]).toEqual({
      code: '1234',
      name: 'テスト製作所',
      account: '特定',
      quantity: 100,
      averageCost: 2345.67,
      price: 2500,
      marketValue: 250000,
      unrealizedPnl: 15433,
      unrealizedPnlPct: 6.58,
    })
    // 符号付き・小数・カンマ区切り
    expect(result.rows[1]).toMatchObject({
      code: '5678',
      quantity: 1000,
      averageCost: 750.5,
      unrealizedPnl: -50000,
      unrealizedPnlPct: -6.66,
    })
    // 同じ銘柄を別口座で
    expect(result.rows[2]).toMatchObject({ code: '1234', account: 'NISA成長投資枠', quantity: 20 })
  })

  it('セクションがなければ RakutenFormatError', () => {
    expect(() => parseRakutenHoldings('■資産合計欄\r\na,b\r\n')).toThrow(RakutenFormatError)
  })

  it('ヘッダが違えば expected/actual を details に入れて失敗', () => {
    const broken = text().replace('銘柄コード・ティッカー', '銘柄コード')
    try {
      parseRakutenHoldings(broken)
      expect.fail('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(RakutenFormatError)
      const details = (e as RakutenFormatError).details as { expected: string[]; actual: string[] }
      expect(details.actual[1]).toBe('銘柄コード')
      expect(details.expected[1]).toBe('銘柄コード・ティッカー')
    }
  })

  it('単位が株でなければ失敗', () => {
    const broken = text().replace('100,株,', '100,口,')
    expect(() => parseRakutenHoldings(broken)).toThrow(/単位が 株 ではありません/)
  })

  it('数値が読めなければ行番号つきで失敗', () => {
    const broken = text().replace('"2,345.67"', 'N/A')
    expect(() => parseRakutenHoldings(broken)).toThrow(/16 行目: 平均取得価額/)
  })
})
