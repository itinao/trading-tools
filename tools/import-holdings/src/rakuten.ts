import { basename } from 'node:path'
import { parseCsv } from './csv.ts'

/** 楽天証券「保有商品詳細」のヘッダ。完全一致で検証する（Design Doc 0003 §3.1） */
export const EXPECTED_HEADER = [
  '種別',
  '銘柄コード・ティッカー',
  '銘柄',
  '口座',
  '保有数量',
  '［単位］',
  '平均取得価額',
  '［単位］',
  '現在値',
  '［単位］',
  '現在値(更新日)',
  '(参考為替)',
  '前日比',
  '［単位］',
  '時価評価額[円]',
  '時価評価額[外貨]',
  '評価損益[円]',
  '評価損益[％]',
] as const

const SECTION_PREFIX = '■ 保有商品詳細'
const TARGET_KIND = '国内株式'

export interface RakutenHoldingRow {
  code: string
  name: string
  account: string
  quantity: number
  averageCost: number
  price: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
}

export interface RakutenParseResult {
  rows: RakutenHoldingRow[]
  /** 種別ごとの読み飛ばし件数 */
  skipped: Record<string, number>
}

export class RakutenFormatError extends Error {
  constructor(
    message: string,
    readonly details: unknown,
  ) {
    super(message)
    this.name = 'RakutenFormatError'
  }
}

/** ファイル名 assetbalance(all)_YYYYMMDD_HHMMSS.csv から as_of（ISO 8601, +09:00）を得る */
export function asOfFromFileName(path: string): string | undefined {
  const m = /_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.csv$/i.exec(basename(path))
  if (!m) return undefined
  const [, y, mo, d, h, mi, s] = m
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`
}

export function decodeShiftJis(bytes: Uint8Array): string {
  return new TextDecoder('shift_jis').decode(bytes)
}

/** CSV 全文（デコード済み）から国内株式の保有行を取り出す */
export function parseRakutenHoldings(text: string): RakutenParseResult {
  const rows = parseCsv(text)
  const sectionIndex = rows.findIndex((r) => r.length === 1 && r[0]?.startsWith(SECTION_PREFIX))
  if (sectionIndex < 0) {
    throw new RakutenFormatError(`セクション「${SECTION_PREFIX}」が見つかりません`, {
      sections: rows.filter((r) => r.length === 1 && r[0]?.startsWith('■')).map((r) => r[0]),
    })
  }
  let headerIndex = sectionIndex + 1
  while (headerIndex < rows.length && isBlank(rows[headerIndex])) headerIndex++
  const header = rows[headerIndex]
  if (!header || !sameHeader(header, EXPECTED_HEADER)) {
    throw new RakutenFormatError('保有商品詳細のヘッダが想定と違います', {
      expected: EXPECTED_HEADER,
      actual: header ?? null,
    })
  }

  const result: RakutenParseResult = { rows: [], skipped: {} }
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || isBlank(row)) break
    const kind = row[0] ?? ''
    if (kind !== TARGET_KIND) {
      result.skipped[kind] = (result.skipped[kind] ?? 0) + 1
      continue
    }
    result.rows.push(parseRow(row, i + 1))
  }
  return result
}

function parseRow(row: string[], line: number): RakutenHoldingRow {
  const col = (i: number) => (row[i] ?? '').trim()
  expectUnit(col(5), '株', line, '保有数量')
  expectUnit(col(7), '円', line, '平均取得価額')
  expectUnit(col(9), '円', line, '現在値')
  const code = col(1)
  if (!/^\d{4}$/.test(code)) {
    throw new RakutenFormatError(`${line} 行目: 銘柄コードが4桁ではありません`, { code })
  }
  return {
    code,
    name: col(2),
    account: col(3),
    quantity: parseInteger(col(4), line, '保有数量'),
    averageCost: parseNumber(col(6), line, '平均取得価額'),
    price: parseNumber(col(8), line, '現在値'),
    marketValue: parseInteger(col(14), line, '時価評価額[円]'),
    unrealizedPnl: parseInteger(col(16), line, '評価損益[円]'),
    unrealizedPnlPct: parseNumber(col(17), line, '評価損益[％]'),
  }
}

function expectUnit(actual: string, expected: string, line: number, column: string): void {
  if (actual !== expected) {
    throw new RakutenFormatError(`${line} 行目: ${column} の単位が ${expected} ではありません`, {
      actual,
    })
  }
}

function parseNumber(raw: string, line: number, column: string): number {
  const normalized = raw.replace(/,/g, '').replace(/^\+/, '')
  if (normalized === '' || Number.isNaN(Number(normalized))) {
    throw new RakutenFormatError(`${line} 行目: ${column} を数値として読めません`, { raw })
  }
  return Number(normalized)
}

function parseInteger(raw: string, line: number, column: string): number {
  const n = parseNumber(raw, line, column)
  if (!Number.isInteger(n)) {
    throw new RakutenFormatError(`${line} 行目: ${column} が整数ではありません`, { raw })
  }
  return n
}

function isBlank(row: string[] | undefined): boolean {
  return !row || row.every((c) => c.trim() === '')
}

function sameHeader(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((c, i) => c.trim() === expected[i])
}
