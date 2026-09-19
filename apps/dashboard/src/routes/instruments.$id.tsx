import { createFileRoute, notFound } from '@tanstack/react-router'
import { getInstrumentPage, InstrumentPage } from '../pages/instrument/index.ts'

export const Route = createFileRoute('/instruments/$id')({
  loader: async ({ params }) => {
    const data = await getInstrumentPage({ data: params.id })
    if (!data) throw notFound()
    return data
  },
  notFoundComponent: () => <p>銘柄が見つからない。</p>,
  component: () => <InstrumentPage data={Route.useLoaderData()} />,
})
