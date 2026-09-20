import { createServerFn } from '@tanstack/react-start'

export const removeWatchFn = createServerFn({ method: 'POST' })
  .validator((input: { code: string }) => {
    if (!/^\d[0-9A-Z]{3}$/.test(input.code)) throw new Error('bad code')
    return input
  })
  .handler(async ({ data }) => {
    const { db } = await import('../../../shared/api')
    const { removeWatch, WatchError } = await import('@trading/domain')
    try {
      return { ok: true as const, ...removeWatch(db(), data.code) }
    } catch (e) {
      if (e instanceof WatchError) return { ok: false as const, code: e.code, message: e.message }
      throw e
    }
  })
