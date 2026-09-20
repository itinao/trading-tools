import { createFileRoute } from '@tanstack/react-router'
import { getWatchPage, WatchPage } from '../pages/watch/index.ts'

export const Route = createFileRoute('/watch')({
  loader: () => getWatchPage(),
  component: () => <WatchPage data={Route.useLoaderData()} />,
})
