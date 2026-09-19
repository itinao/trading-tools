import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/** ルートレイアウト。<html> と <body> は routes/__root.tsx が担当し、ここはナビと main */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav>
        <Link to="/" activeOptions={{ exact: true }}>
          アクション
        </Link>
        <Link to="/holdings">保有</Link>
      </nav>
      <main>{children}</main>
    </>
  )
}
