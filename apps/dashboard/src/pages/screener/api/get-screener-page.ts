import { createServerFn } from '@tanstack/react-start'
import type { ScreenResultRow } from '../../../widgets/screen-result-table/index.ts'

export const getScreenerPage = createServerFn({ method: 'GET' })
  .validator((input: { run?: number }) => input)
  .handler(async ({ data }) => {
    const runId = data.run
    const { db } = await import('../../../shared/api')
    const { getScreenRun, listScreenRuns, monitoredInstruments } = await import('@trading/domain')
    const d = db()
    const runs = listScreenRuns(d, 20)
    const selected = runId ?? runs[0]?.id
    const run = selected === undefined ? undefined : getScreenRun(d, selected)
    const status = new Map(monitoredInstruments(d).map((m) => [m.code, m.context]))
    const rows: ScreenResultRow[] = (run?.results ?? []).map((r) => ({
      rank: r.rank,
      code: r.code,
      name: r.name,
      segment: r.segment,
      sector33: r.sector33,
      price: r.price,
      per: r.per,
      forwardPer: r.forwardPer,
      pbr: r.pbr,
      dividendYield: r.dividendYield,
      marketCap: r.marketCap,
      growthYears: r.growthYears,
      status: status.get(r.code) ?? null,
    }))
    return {
      runs: runs.map((r) => ({
        id: r.id,
        executedAt: r.executedAt,
        preset: r.preset,
        matched: r.matched,
        universeSize: r.universeSize,
      })),
      run: run
        ? {
            id: run.id,
            executedAt: run.executedAt,
            preset: run.preset,
            criteriaJson: run.criteriaJson,
            universeSize: run.universeSize,
            matched: run.matched,
          }
        : null,
      rows,
    }
  })

export type ScreenerPageData = Awaited<ReturnType<typeof getScreenerPage>>
