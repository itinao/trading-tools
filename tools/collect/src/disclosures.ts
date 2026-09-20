import { isIsoDate, nowJst, type ToolContext, todayJst, UsageError } from '@trading/cli'
import { type DatabaseHandle, schema } from '@trading/db'
import type { DisclosureCategory } from '@trading/db/schema'
import type { DisclosureProvider } from '@trading/market-data'
import { requireTargets } from './shared.ts'

export interface DisclosuresResult {
  provider: string
  dates: string[]
  scanned: number
  matched: number
  inserted: number
  failed: { date: string; reason: string }[]
}

/** 表題から種別を機械的に付ける。上方 / 下方の向きは付けない（Design Doc 0010 §3.3） */
export function categorize(title: string): DisclosureCategory {
  if (/決算短信/.test(title)) return 'earnings'
  if (/業績予想/.test(title) && /修正/.test(title)) return 'forecast_revision'
  if (/配当/.test(title)) return 'dividend'
  return 'other'
}

function yesterdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** その日（既定は今日と前日）の TDnet 全件から保有銘柄の開示を保存する。(instrument, pdf_url) が既にあれば無視 */
export async function collectDisclosures(
  handle: DatabaseHandle,
  context: ToolContext,
  options: { date?: string },
  provider: DisclosureProvider,
): Promise<DisclosuresResult> {
  if (options.date !== undefined && !isIsoDate(options.date))
    throw new UsageError(`--date は YYYY-MM-DD: ${options.date}`)
  const targets = requireTargets(handle)
  const byCode = new Map(targets.map((t) => [t.code, t]))
  const dates = options.date ? [options.date] : [yesterdayOf(todayJst()), todayJst()]
  const fetchedAt = nowJst()
  const result: DisclosuresResult = {
    provider: provider.name,
    dates,
    scanned: 0,
    matched: 0,
    inserted: 0,
    failed: [],
  }
  for (const date of dates) {
    let items: Awaited<ReturnType<DisclosureProvider['fetchDisclosures']>>
    try {
      items = await provider.fetchDisclosures(date)
    } catch (e) {
      result.failed.push({ date, reason: e instanceof Error ? e.message : String(e) })
      continue
    }
    result.scanned += items.length
    const rows = items
      .filter((d) => byCode.has(d.code))
      .map((d) => ({
        instrumentId: byCode.get(d.code)?.instrumentId as string,
        disclosedAt: d.disclosedAt,
        title: d.title,
        pdfUrl: d.pdfUrl,
        category: categorize(d.title),
        hasXbrl: d.hasXbrl ? 1 : 0,
        source: provider.name,
        fetchedAt,
      }))
    result.matched += rows.length
    for (const r of rows)
      context.logger.info(`${date} ${r.instrumentId} [${r.category}] ${r.title}`)
    if (context.options.dryRun || rows.length === 0) continue
    const ins = handle.db
      .insert(schema.disclosures)
      .values(rows)
      .onConflictDoNothing({ target: [schema.disclosures.instrumentId, schema.disclosures.pdfUrl] })
      .run()
    result.inserted += ins.changes
  }
  if (result.failed.length === dates.length) {
    const { ToolError } = await import('@trading/cli')
    throw new ToolError('all_failed', 'すべての日付で取得に失敗しました', {
      details: { failed: result.failed },
    })
  }
  return result
}
