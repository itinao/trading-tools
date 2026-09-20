import { DEFAULT_HEADERS, type FetchLike, type NewsItem, type NewsProvider } from './provider.ts'

/** Google News RSS。Design Doc 0009 §2.2 / 0010 §3.1 */

export interface GoogleNewsOptions {
  fetch?: FetchLike
}

/** 検索語にする銘柄名の正規化: NFKC（全角英数 → 半角）、法人格の除去、空白の整理 */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/株式会社|\(株\)|（株）|合同会社|有限会社/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function googleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`
}

const ITEM_RE = /<item>([\s\S]*?)<\/item>/g
const tag = (s: string, name: string): string | undefined => {
  const m = new RegExp(
    `<${name}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`,
  ).exec(s)
  return m?.[1]?.trim()
}
const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

/** RSS の XML から見出しを取り出す。媒体名は <source> タグ、無ければ見出し末尾の " - 媒体名" */
export function parseGoogleNewsRss(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  for (const m of xml.matchAll(ITEM_RE)) {
    const body = m[1] as string
    const rawTitle = tag(body, 'title')
    const url = tag(body, 'link')
    const pubDate = tag(body, 'pubDate')
    if (!rawTitle || !url || !pubDate) continue
    const published = new Date(pubDate)
    if (Number.isNaN(published.getTime())) continue
    let title = decodeEntities(rawTitle)
    let publisher = tag(body, 'source')
    const suffix = / - ([^-]+)$/.exec(title)
    if (suffix) {
      publisher ??= suffix[1]?.trim()
      title = title.slice(0, suffix.index).trim()
    }
    const item: NewsItem = { title, url, publishedAt: toJstIso(published) }
    if (publisher) item.publisher = decodeEntities(publisher)
    items.push(item)
  }
  return items
}

function toJstIso(d: Date): string {
  const s = new Date(d.getTime() + 9 * 3600 * 1000).toISOString()
  return `${s.slice(0, 19)}+09:00`
}

export function createGoogleNewsProvider(options: GoogleNewsOptions = {}): NewsProvider {
  const doFetch = options.fetch ?? (fetch as unknown as FetchLike)
  return {
    name: 'google-news',
    async fetchNews(query) {
      const res = await doFetch(googleNewsUrl(query), { headers: DEFAULT_HEADERS })
      if (!res.ok) throw new Error(`google news: HTTP ${res.status}`)
      return parseGoogleNewsRss(await res.text())
    },
  }
}
