import { hostname } from 'node:os'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// 開発サーバーは node_modules のフォントを Cache-Control: no-cache で返すので、リロードのたびに 130 ファイルを再検証し、
// その間フォールバックの書体で描かれてチラつく。フォントは中身が変わらないので長くキャッシュさせる
const cacheFonts = (): Plugin => ({
  name: 'trading:cache-fonts',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0]?.endsWith('.woff2')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }
      next()
    })
  },
})

export default defineConfig(({ mode }) => {
  // apps/dashboard/.env.local（gitignore）も読む。Tailscale の MagicDNS 名のようにマシン名から導けない名前はそこに書く
  const env = { ...loadEnv(mode, import.meta.dirname, ''), ...process.env }
  // Vite は Host ヘッダを検査する（DNS rebinding 対策）。このマシンの名前（mDNS の .local）と Tailscale の .ts.net を許可し、
  // ほかは ALLOWED_HOSTS=a,b で足す。マシン名はここに書かない（リポジトリに個人の名前を残さない）
  const machine = hostname().toLowerCase()
  const allowedHosts = [
    machine,
    machine.split('.')[0] as string,
    '.local',
    '.ts.net',
    ...(env.ALLOWED_HOSTS?.split(',').filter(Boolean) ?? []),
  ]
  return {
    // 同じネットワークの端末（スマホ等）から見るため 0.0.0.0 で待つ。認証は無いので、LAN や Tailscale の外には出さない
    server: {
      port: Number(env.PORT ?? 3000),
      host: env.HOST ?? '0.0.0.0',
      allowedHosts,
    },
    // better-sqlite3 はネイティブ拡張（bindings が __filename を使う）。@trading/db 経由で届くのでバンドルせず外部参照にする
    ssr: { external: ['better-sqlite3'] },
    plugins: [cacheFonts(), tanstackStart({ router: { entry: 'app/router.tsx' } }), viteReact()],
  }
})
