import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createGoogleNewsProvider,
  googleNewsUrl,
  normalizeCompanyName,
  parseGoogleNewsRss,
} from '../src/index.ts'

const xml = readFileSync(join(import.meta.dirname, 'fixtures', 'google-news.xml'), 'utf8')

describe('normalizeCompanyName', () => {
  it('全角英数を半角に、法人格を除く', () => {
    expect(normalizeCompanyName('ＩＮＰＥＸ')).toBe('INPEX')
    expect(normalizeCompanyName('株式会社テスト製作所')).toBe('テスト製作所')
    expect(normalizeCompanyName('テスト　ホールディングス（株）')).toBe('テスト ホールディングス')
  })
})

describe('parseGoogleNewsRss', () => {
  it('見出し・URL・日時（JST）・媒体を取り出し、不完全な項目は捨てる', () => {
    const items = parseGoogleNewsRss(xml)
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({
      title: 'テスト製作所、今期の業績予想を下方修正',
      url: 'https://news.google.com/rss/articles/AAA?oc=5',
      publishedAt: '2026-09-19T05:00:00+09:00',
      publisher: '日本経済新聞',
    })
    // <source> が無ければ見出し末尾の " - 媒体名"。&amp; は復元
    expect(items[1]).toMatchObject({
      title: 'テスト製作所の新型製品が話題 & 好評',
      publisher: 'テストメディア',
    })
  })
})

describe('createGoogleNewsProvider', () => {
  it('検索 URL に正規化した語を入れ、RSS を解析する', async () => {
    const calls: string[] = []
    const p = createGoogleNewsProvider({
      fetch: async (url) => {
        calls.push(url)
        return { ok: true, status: 200, text: async () => xml }
      },
    })
    const items = await p.fetchNews('テスト製作所')
    expect(items).toHaveLength(2)
    expect(calls[0]).toBe(googleNewsUrl('テスト製作所'))
    expect(calls[0]).toContain('ceid=JP:ja')
  })
  it('HTTP エラーは例外', async () => {
    const p = createGoogleNewsProvider({
      fetch: async () => ({ ok: false, status: 503, text: async () => '' }),
    })
    await expect(p.fetchNews('x')).rejects.toThrow(/503/)
  })
})
