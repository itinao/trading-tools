import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // 同じネットワークの端末（スマホ等）から見るため 0.0.0.0 で待つ。認証は無いので、LAN や Tailscale の外には出さない
  server: { port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '0.0.0.0' },
  plugins: [tanstackStart({ router: { entry: 'app/router.tsx' } }), viteReact()],
})
