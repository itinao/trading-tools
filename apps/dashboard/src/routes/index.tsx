import { createFileRoute } from '@tanstack/react-router'
import { type ActionStatus, isActionStatus } from '../entities/action/index.ts'
import { ActionsPage, getActionsPage } from '../pages/actions/index.ts'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { status?: ActionStatus } =>
    isActionStatus(search.status) ? { status: search.status } : {},
  loaderDeps: ({ search }) => ({ status: search.status ?? 'open' }),
  loader: ({ deps }) => getActionsPage({ data: deps.status }),
  component: () => <ActionsPage data={Route.useLoaderData()} />,
})
