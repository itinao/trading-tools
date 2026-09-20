import { DEFAULT_HEADERS } from './provider.ts'

/** JPX「東証上場銘柄一覧」（xlsx、月次）。スクリーニングの母集団。Design Doc 0013 §3.1 */

export const JPX_LISTING_URL =
  'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xlsx'
export const EXPECTED_COLUMNS = [
  '日付',
  'コード',
  '銘柄名',
  '市場・商品区分',
  '33業種区分',
  '規模区分',
] as const

export type Segment = 'prime' | 'standard' | 'growth' | 'other'

export interface ListedCompany {
  code: string
  name: string
  segment: Segment
  segmentRaw: string
  sector33: string | null
  size: string | null
  listedAsOf: string
}

export class JpxFormatError extends Error {
  constructor(
    message: string,
    readonly details: unknown,
  ) {
    super(message)
    this.name = 'JpxFormatError'
  }
}

function segmentOf(raw: string): Segment {
  if (raw.startsWith('プライム')) return 'prime'
  if (raw.startsWith('スタンダード')) return 'standard'
  if (raw.startsWith('グロース')) return 'growth'
  return 'other'
}

const dash = (v: unknown) => {
  const s = String(v ?? '').trim()
  return s === '' || s === '-' ? null : s
}

/** xlsx のバイト列を解析する */
export async function parseJpxListing(bytes: Uint8Array): Promise<ListedCompany[]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(bytes, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined
  if (!sheet) throw new JpxFormatError('シートがありません', { sheets: wb.SheetNames })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  const first = rows[0]
  const missing = EXPECTED_COLUMNS.filter((c) => !first || !(c in first))
  if (rows.length === 0 || missing.length > 0) {
    throw new JpxFormatError('上場銘柄一覧の列が想定と違います', {
      expected: EXPECTED_COLUMNS,
      actual: first ? Object.keys(first) : null,
      missing,
    })
  }
  return rows
    .map((r) => {
      const code = String(r['コード'] ?? '').trim()
      const d = String(r['日付'] ?? '')
      const listedAsOf = /^\d{8}$/.test(d)
        ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
        : d
      const segmentRaw = String(r['市場・商品区分'] ?? '')
      return {
        code,
        name: String(r['銘柄名'] ?? '').trim(),
        segment: segmentOf(segmentRaw),
        segmentRaw,
        sector33: dash(r['33業種区分']),
        size: dash(r['規模区分']),
        listedAsOf,
      }
    })
    .filter((c) => /^\d[0-9A-Z]{3}$/.test(c.code) && c.name !== '')
}

export interface JpxOptions {
  url?: string
  fetch?: (
    url: string,
    init?: { headers?: Record<string, string> },
  ) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>
}

export async function fetchJpxListing(options: JpxOptions = {}): Promise<ListedCompany[]> {
  const doFetch = options.fetch ?? (fetch as unknown as NonNullable<JpxOptions['fetch']>)
  const res = await doFetch(options.url ?? JPX_LISTING_URL, {
    headers: { ...DEFAULT_HEADERS, 'user-agent': 'Mozilla/5.0 (trading-tools; personal)' },
  })
  if (!res.ok) throw new Error(`jpx: HTTP ${res.status}`)
  return parseJpxListing(new Uint8Array(await res.arrayBuffer()))
}
