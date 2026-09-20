import { createFileRoute } from '@tanstack/react-router'
import { getHistoryPage, HistoryPage } from '../pages/history/index.ts'

export const Route = createFileRoute('/history')({
  validateSearch: (search: Record<string, unknown>): { since?: string } =>
    typeof search.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.since)
      ? { since: search.since }
      : {},
  loaderDeps: ({ search }) => ({ since: search.since }),
  loader: ({ deps }) => getHistoryPage({ data: deps.since ? { since: deps.since } : {} }),
  component: () => <HistoryPage data={Route.useLoaderData()} />,
})
