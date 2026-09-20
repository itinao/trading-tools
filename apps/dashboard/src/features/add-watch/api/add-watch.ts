import { createServerFn } from '@tanstack/react-start'

/** ウォッチに追加する。CLI の `watch add` と同じ addWatch */
export const addWatchFn = createServerFn({ method: 'POST' })
  .validator((input: { code: string; note?: string; screenRunId?: number }) => {
    if (!/^\d[0-9A-Z]{3}$/.test(input.code)) throw new Error('bad code')
    return input
  })
  .handler(async ({ data }) => {
    const { db } = await import('../../../shared/api')
    const { addWatch, WatchError } = await import('@trading/domain')
    try {
      return {
        ok: true as const,
        ...addWatch(db(), data.code, {
          ...(data.note ? { note: data.note } : {}),
          source: data.screenRunId ? 'screen' : 'manual',
          ...(data.screenRunId ? { screenRunId: data.screenRunId } : {}),
        }),
      }
    } catch (e) {
      if (e instanceof WatchError) return { ok: false as const, code: e.code, message: e.message }
      throw e
    }
  })
