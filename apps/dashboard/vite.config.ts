import { hostname } from 'node:os'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Vite は Host ヘッダを検査する（DNS rebinding 対策）。このマシンの名前（mDNS の .local、Tailscale MagicDNS の短い名前と
// .ts.net）を許可する。ほかに必要なら ALLOWED_HOSTS=a,b で足す。マシン名はここに書かない（リポジトリに個人の名前を残さない）
const machine = hostname().toLowerCase()
const allowedHosts = [
  machine,
  machine.split('.')[0] as string,
  '.local',
  '.ts.net',
  ...(process.env.ALLOWED_HOSTS?.split(',').filter(Boolean) ?? []),
]

export default defineConfig({
  // 同じネットワークの端末（スマホ等）から見るため 0.0.0.0 で待つ。認証は無いので、LAN や Tailscale の外には出さない
  server: {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
    allowedHosts,
  },
  plugins: [tanstackStart({ router: { entry: 'app/router.tsx' } }), viteReact()],
})
