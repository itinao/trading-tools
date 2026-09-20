import { createServerFn } from '@tanstack/react-start'

/** サイドバーの状態（件数・鮮度・最終収集）。ルートのローダーで 1 回だけ取る（Design Doc 0015 R2） */
export const getShell = createServerFn({ method: 'GET' }).handler(async () => {
  const { db, lastCollectRun } = await import('../../shared/api')
  const { dashboardStatus } = await import('@trading/domain')
  const { todayJst } = await import('@trading/cli')
  return { today: todayJst(), status: dashboardStatus(db()), lastCollect: lastCollectRun() }
})

export type ShellData = Awaited<ReturnType<typeof getShell>>
