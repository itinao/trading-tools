import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { removeWatchFn } from '../api/remove-watch.ts'

export function RemoveWatchButton({ code }: { code: string }) {
  const router = useRouter()
  const remove = useServerFn(removeWatchFn)
  return (
    <button
      type="button"
      onClick={async () => {
        await remove({ data: { code } })
        await router.invalidate()
      }}
    >
      外す
    </button>
  )
}
