import { createFileRoute, notFound } from '@tanstack/react-router'
import { getInstrumentPage, InstrumentPage, type InstrumentTab } from '../pages/instrument/index.ts'

const TABS: InstrumentTab[] = ['overview', 'timeline', 'news', 'financials', 'quotes']

export const Route = createFileRoute('/instruments/$id')({
  validateSearch: (search: Record<string, unknown>): { tab?: InstrumentTab } =>
    TABS.includes(search.tab as InstrumentTab) && search.tab !== 'overview'
      ? { tab: search.tab as InstrumentTab }
      : {},
  loader: async ({ params }) => {
    const data = await getInstrumentPage({ data: params.id })
    if (!data) throw notFound()
    return data
  },
  notFoundComponent: () => <p>銘柄が見つからない。</p>,
  component: () => (
    <InstrumentPage data={Route.useLoaderData()} tab={Route.useSearch().tab ?? 'overview'} />
  ),
})
