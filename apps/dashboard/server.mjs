// 本番の起動（pnpm dashboard:build のあと pnpm dashboard:start）。
// srvx の CLI ではなく自前にしているのは、ハッシュ付きの静的ファイル（/assets/*）に長いキャッシュを付けるため。
// これが無いとフォント（130 ファイル）がリロードのたびに取り直され、文字が一瞬フォールバックの書体で出てチラつく。
import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'
import app from './dist/server/server.js'

const clientDir = new URL('./dist/client', import.meta.url).pathname

const immutableAssets = async (request, next) => {
  const response = await next()
  if (response && new URL(request.url).pathname.startsWith('/assets/')) {
    response.headers.set('cache-control', 'public, max-age=31536000, immutable')
  }
  return response
}

const server = serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? '0.0.0.0',
  middleware: [immutableAssets, serveStatic({ dir: clientDir })],
  fetch: app.fetch,
})
await server.ready()
console.error(
  `dashboard: http://localhost:${server.options.port ?? 3000}/ (${server.options.hostname})`,
)
