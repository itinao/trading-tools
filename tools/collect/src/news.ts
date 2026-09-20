import { nowJst, type ToolContext, ToolError } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import { monitoredInstruments } from '@trading/domain'
import { type NewsProvider, normalizeCompanyName } from '@trading/market-data'
import { type Failed, logFailures } from './shared.ts'

export interface NewsResult {
  provider: string
  fetched: number
  inserted: number
  failed: Failed[]
}

/** 銘柄名で検索したニュースの見出しを保存する。(instrument, url) が既にあれば無視 */
export async function collectNews(
  handle: DatabaseHandle,
  context: ToolContext,
  provider: NewsProvider,
): Promise<NewsResult> {
  const targets = monitoredInstruments(handle.db)
  if (targets.length === 0)
    throw new ToolError(
      'no_targets',
      '収集対象の銘柄がありません。先に import-holdings を実行してください',
    )
  const fetchedAt = nowJst()
  const failed: Failed[] = []
  let fetched = 0
  let inserted = 0
  for (const t of targets) {
    const query = normalizeCompanyName(t.name)
    try {
      const items = await provider.fetchNews(query)
      fetched++
      if (items.length === 0) context.logger.warn(`${t.code}: no news for "${query}"`)
      if (context.options.dryRun || items.length === 0) continue
      const r = handle.db
        .insert(schema.newsItems)
        .values(
          items.map((n) => ({
            instrumentId: t.instrumentId,
            publishedAt: n.publishedAt,
            title: n.title,
            url: n.url,
            publisher: n.publisher ?? null,
            source: provider.name,
            fetchedAt,
          })),
        )
        .onConflictDoNothing({ target: [schema.newsItems.instrumentId, schema.newsItems.url] })
        .run()
      inserted += r.changes
    } catch (e) {
      failed.push({ code: t.code, reason: e instanceof Error ? e.message : String(e) })
    }
  }
  if (fetched === 0)
    throw new ToolError('all_failed', 'すべての銘柄で取得に失敗しました', { details: { failed } })
  logFailures(context, failed)
  return { provider: provider.name, fetched, inserted, failed }
}
