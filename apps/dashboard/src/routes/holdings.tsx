import { createFileRoute } from '@tanstack/react-router'
import { getHoldingsPage, HoldingsPage } from '../pages/holdings/index.ts'

export const Route = createFileRoute('/holdings')({
  loader: () => getHoldingsPage(),
  component: () => <HoldingsPage data={Route.useLoaderData()} />,
})
