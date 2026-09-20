import {
  DEFAULT_HEADERS,
  type DisclosureItem,
  type DisclosureProvider,
  type FetchLike,
  sleep,
} from './provider.ts'

/** TDnet 適時開示情報閲覧サービス。日付ごとの一覧ページを読む。Design Doc 0009 §2.3 / 0010 §3.1 */

export interface TdnetOptions {
  fetch?: FetchLike
  intervalMs?: number
}

const BASE = 'https://www.release.tdnet.info/inbs/'
export const EXPECTED_HEADER = ['時刻', 'コード', '会社名', '表題', 'XBRL'] as const

export class TdnetFormatError extends Error {
  constructor(
    message: string,
    readonly details: unknown,
  ) {
    super(message)
    this.name = 'TdnetFormatError'
  }
}

export function tdnetListUrl(date: string, page: number): string {
  return `${BASE}I_list_${String(page).padStart(3, '0')}_${date.replace(/-/g, '')}.html`
}

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** 一覧ページ 1 枚を解析する。戻り値の pages はそのページから分かるページ番号の集合 */
export function parseTdnetList(
  html: string,
  date: string,
): { items: DisclosureItem[]; pages: number[] } {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1] as string)
  const header = rows
    .map((r) =>
      [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1] as string)),
    )
    .find((cells) => cells[0] === '時刻')
  if (!header || EXPECTED_HEADER.some((h, i) => header[i] !== h)) {
    throw new TdnetFormatError('TDnet の一覧のヘッダが想定と違います', {
      expected: EXPECTED_HEADER,
      actual: header ?? null,
    })
  }
  const items: DisclosureItem[] = []
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1] as string)
    if (cells.length < 5) continue
    const time = strip(cells[0] as string)
    const code = strip(cells[1] as string)
    // 証券コードは 5 桁（4 桁 + 0）。4 桁目に英字が入るコード（264A など）もある
    if (!/^\d{2}:\d{2}$/.test(time) || !/^\d[0-9A-Z]{3}\d$/.test(code)) continue
    const pdf = /href="([^"]+\.pdf)"/.exec(cells[3] as string)?.[1]
    if (!pdf) continue
    items.push({
      code: code.slice(0, 4),
      companyName: strip(cells[2] as string),
      disclosedAt: `${date}T${time}:00+09:00`,
      title: strip(cells[3] as string),
      pdfUrl: pdf.startsWith('http') ? pdf : `${BASE}${pdf.replace(/^\.?\//, '')}`,
      hasXbrl: /\.zip"|xbrl/i.test(cells[4] as string),
    })
  }
  const compact = date.replace(/-/g, '')
  const pages = [
    ...new Set(
      [...html.matchAll(new RegExp(`I_list_(\\d{3})_${compact}\\.html`, 'g'))].map((m) =>
        Number(m[1]),
      ),
    ),
  ]
  return { items, pages: pages.sort((a, b) => a - b) }
}

export function createTdnetProvider(options: TdnetOptions = {}): DisclosureProvider {
  const doFetch = options.fetch ?? (fetch as unknown as FetchLike)
  const intervalMs = options.intervalMs ?? 200
  return {
    name: 'tdnet',
    async fetchDisclosures(date) {
      const all: DisclosureItem[] = []
      const seen = new Set<string>()
      const visited = new Set<number>()
      const queue = [1]
      while (queue.length > 0) {
        const page = queue.shift() as number
        if (visited.has(page)) continue
        visited.add(page)
        const res = await doFetch(tdnetListUrl(date, page), { headers: DEFAULT_HEADERS })
        if (!res.ok) {
          if (page === 1) throw new Error(`tdnet: HTTP ${res.status}`)
          break
        }
        const { items, pages } = parseTdnetList(await res.text(), date)
        for (const it of items) {
          if (seen.has(it.pdfUrl)) continue
          seen.add(it.pdfUrl)
          all.push(it)
        }
        for (const p of pages) if (!visited.has(p) && !queue.includes(p)) queue.push(p)
        queue.sort((a, b) => a - b)
        if (queue.length > 0) await sleep(intervalMs)
      }
      return all
    },
  }
}
