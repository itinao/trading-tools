import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createTdnetProvider,
  parseTdnetList,
  TdnetFormatError,
  tdnetListUrl,
} from '../src/index.ts'

const page = (n: number) =>
  readFileSync(join(import.meta.dirname, 'fixtures', `tdnet-list-${n}.html`), 'utf8')

describe('parseTdnetList', () => {
  it('行を開示に変換し、ページ番号を集める', () => {
    const { items, pages } = parseTdnetList(page(1), '2026-09-18')
    expect(pages).toEqual([1, 2, 3])
    expect(items).toHaveLength(3)
    expect(items[0]).toEqual({
      code: '1234',
      companyName: 'テスト製作所',
      disclosedAt: '2026-09-18T19:30:00+09:00',
      title: '2027年3月期第2四半期（中間期）連結累計期間業績予想の修正に関するお知らせ',
      pdfUrl: 'https://www.release.tdnet.info/inbs/140120260918000001.pdf',
      hasXbrl: true,
    })
    expect(items[1]).toMatchObject({ code: '5678', hasXbrl: false })
    expect(items[2]).toMatchObject({ code: '264A' })
  })
  it('開示が 0 件の日（休日）は空を返す', () => {
    const html =
      '<html><body><table><tr><td>2026年09月20日<br>に開示された情報はありません。</td></tr></table></body></html>'
    expect(parseTdnetList(html, '2026-09-20')).toEqual({ items: [], pages: [] })
  })
  it('ヘッダが違えば TdnetFormatError', () => {
    expect(() =>
      parseTdnetList(page(1).replace('<th>表題</th>', '<th>件名</th>'), '2026-09-18'),
    ).toThrow(TdnetFormatError)
  })
})

describe('createTdnetProvider', () => {
  it('ページを辿り、PDF の重複を除く', async () => {
    const calls: string[] = []
    const p = createTdnetProvider({
      intervalMs: 0,
      fetch: async (url) => {
        calls.push(url)
        const n = Number(/I_list_(\d{3})/.exec(url)?.[1])
        if (n === 3) return { ok: false, status: 404, text: async () => '' }
        return { ok: true, status: 200, text: async () => page(n) }
      },
    })
    const items = await p.fetchDisclosures('2026-09-18')
    expect(calls).toEqual([
      tdnetListUrl('2026-09-18', 1),
      tdnetListUrl('2026-09-18', 2),
      tdnetListUrl('2026-09-18', 3),
    ])
    expect(items).toHaveLength(4)
    expect(items.filter((i) => i.code === '1234')).toHaveLength(2)
  })
  it('1 ページ目が取れなければ例外', async () => {
    const p = createTdnetProvider({
      fetch: async () => ({ ok: false, status: 500, text: async () => '' }),
    })
    await expect(p.fetchDisclosures('2026-09-18')).rejects.toThrow(/500/)
  })
})
