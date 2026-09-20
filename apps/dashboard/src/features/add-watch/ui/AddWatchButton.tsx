import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { addWatchFn } from '../api/add-watch.ts'

/** 「ウォッチに追加」ボタン。追加済み・保有中はメッセージを出す */
export function AddWatchButton({
  code,
  screenRunId,
  note,
}: {
  code: string
  screenRunId?: number
  note?: string
}) {
  const router = useRouter()
  const add = useServerFn(addWatchFn)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <span className="actions">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const r = await add({
              data: { code, ...(screenRunId ? { screenRunId } : {}), ...(note ? { note } : {}) },
            })
            setMessage(r.ok ? '追加しました' : r.message)
            if (r.ok) await router.invalidate()
          } finally {
            setBusy(false)
          }
        }}
      >
        ウォッチに追加
      </button>
      {message && <span className="muted">{message}</span>}
    </span>
  )
}
