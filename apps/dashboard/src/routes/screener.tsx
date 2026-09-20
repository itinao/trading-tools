import { createFileRoute } from '@tanstack/react-router'
import { getScreenerPage, ScreenerPage } from '../pages/screener/index.ts'

export const Route = createFileRoute('/screener')({
  validateSearch: (search: Record<string, unknown>): { run?: number } =>
    Number.isInteger(search.run) ? { run: search.run as number } : {},
  loaderDeps: ({ search }) => ({ run: search.run }),
  loader: ({ deps }) => getScreenerPage({ data: deps.run === undefined ? {} : { run: deps.run } }),
  component: () => <ScreenerPage data={Route.useLoaderData()} />,
})
