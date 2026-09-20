import { createFileRoute } from '@tanstack/react-router'
import {
  getInstrumentsPage,
  InstrumentsPage,
  type InstrumentsTab,
} from '../pages/instruments/index.ts'

export const Route = createFileRoute('/instruments/')({
  validateSearch: (search: Record<string, unknown>): { tab?: InstrumentsTab } =>
    search.tab === 'watch' ? { tab: 'watch' } : {},
  loader: () => getInstrumentsPage(),
  component: () => (
    <InstrumentsPage data={Route.useLoaderData()} tab={Route.useSearch().tab ?? 'holding'} />
  ),
})
