import type { ReactNode } from 'react'
import { Sidebar, type SidebarData } from '../widgets/sidebar/index.ts'

/** ルートレイアウト。左にサイドバー、右にコンテンツ（中央寄せ）。<html> と <body> は routes/__root.tsx が担当 */
export function AppLayout({ shell, children }: { shell: SidebarData; children: ReactNode }) {
  return (
    <div className="app">
      <Sidebar data={shell} />
      <main className="content">{children}</main>
    </div>
  )
}
