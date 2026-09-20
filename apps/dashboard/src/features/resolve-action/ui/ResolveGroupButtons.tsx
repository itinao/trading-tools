import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import type { ActionStatus } from '../../../entities/action/index.ts'
import { resolveActions } from '../api/resolve-actions.ts'

/** 銘柄カードの一括操作。未対応が複数あればまとめて、状態が open 以外なら「未対応に戻す」 */
export function ResolveGroupButtons({ ids, status }: { ids: number[]; status: string }) {
  const router = useRouter()
  const resolve = useServerFn(resolveActions)
  const [busy, setBusy] = useState(false)
  const change = async (next: ActionStatus) => {
    setBusy(true)
    try {
      await resolve({ data: { ids, status: next } })
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }
  const n = ids.length > 1 ? `（${ids.length} 件）` : ''
  if (status === 'open') {
    return (
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => change('done')}>
          まとめて対応した{n}
        </button>
        <button type="button" disabled={busy} onClick={() => change('dismissed')}>
          まとめて見送り{n}
        </button>
      </div>
    )
  }
  return (
    <button type="button" disabled={busy} onClick={() => change('open')}>
      未対応に戻す{n}
    </button>
  )
}
