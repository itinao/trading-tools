import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { getShell } from '../app/api/get-shell.ts'
import { AppLayout } from '../app/layout.tsx'
import '../app/fonts.css'
import '../app/styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Trading' },
    ],
    links: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  }),
  loader: () => getShell(),
  component: () => (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppLayout shell={Route.useLoaderData()}>
          <Outlet />
        </AppLayout>
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: () => <p>ページが見つかりません。</p>,
})
