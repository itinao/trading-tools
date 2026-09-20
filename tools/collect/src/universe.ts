import { type ToolContext, ToolError } from '@trading/cli'
import type { DatabaseHandle } from '@trading/db'
import { upsertUniverse } from '@trading/domain'
import { fetchJpxListing, JpxFormatError, type ListedCompany } from '@trading/market-data'

export interface UniverseResult {
  source: 'jpx'
  listedAsOf: string | null
  rows: number
  bySegment: Record<string, number>
}

/** 上場銘柄一覧を入れ替える（月 1 回で十分。collect all には含めない） */
export async function collectUniverse(
  handle: DatabaseHandle,
  context: ToolContext,
  fetchListing: () => Promise<ListedCompany[]> = () => fetchJpxListing(),
): Promise<UniverseResult> {
  let rows: ListedCompany[]
  try {
    rows = await fetchListing()
  } catch (e) {
    if (e instanceof JpxFormatError)
      throw new ToolError('unexpected_format', e.message, { details: e.details })
    throw new ToolError('fetch_failed', e instanceof Error ? e.message : String(e))
  }
  const bySegment: Record<string, number> = {}
  for (const r of rows) bySegment[r.segment] = (bySegment[r.segment] ?? 0) + 1
  context.logger.info(`jpx listing: ${rows.length} rows ${JSON.stringify(bySegment)}`)
  if (!context.options.dryRun) upsertUniverse(handle.db, rows)
  return { source: 'jpx', listedAsOf: rows[0]?.listedAsOf ?? null, rows: rows.length, bySegment }
}
