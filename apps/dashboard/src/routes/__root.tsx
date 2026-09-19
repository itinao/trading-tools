import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { AppLayout } from '../app/layout.tsx'
import '../app/styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'trading-tools' },
    ],
  }),
  component: () => (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppLayout>
          <Outlet />
        </AppLayout>
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: () => <p>ページが見つからない。</p>,
})
