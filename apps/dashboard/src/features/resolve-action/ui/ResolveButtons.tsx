import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { ActionStatus } from '../../../entities/action/index.ts'
import { resolveAction } from '../api/resolve-action.ts'

/** 未対応なら「対応した / 見送り」、それ以外なら「未対応に戻す」 */
export function ResolveButtons({ id, status }: { id: number; status: string }) {
  const router = useRouter()
  const resolve = useServerFn(resolveAction)
  const change = async (next: ActionStatus) => {
    await resolve({ data: { id, status: next } })
    await router.invalidate()
  }
  if (status === 'open') {
    return (
      <>
        <button type="button" onClick={() => change('done')}>
          対応した
        </button>{' '}
        <button type="button" onClick={() => change('dismissed')}>
          見送り
        </button>
      </>
    )
  }
  return (
    <button type="button" onClick={() => change('open')}>
      未対応に戻す
    </button>
  )
}
