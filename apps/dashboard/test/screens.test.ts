import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@trading/cli'
import { describe, expect, it } from 'vitest'
import { collectScreens, renderScreensDoc } from '../src/app/screens.ts'

const src = join(import.meta.dirname, '..', 'src')

describe('docs/screens.md', () => {
  it('ルートと Link から生成した内容と一致する（違えば pnpm screens）', () => {
    const committed = readFileSync(join(findWorkspaceRoot(), 'docs', 'screens.md'), 'utf8')
    expect(committed).toBe(renderScreensDoc(src))
  })

  it('各画面に説明（ページの JSDoc）がある', () => {
    for (const s of collectScreens(src)) {
      expect(s.description, s.path).toBeTruthy()
      expect(s.pageSlice, s.path).toBeTruthy()
    }
  })

  it('アクション一覧から銘柄詳細へ遷移できる', () => {
    const screens = collectScreens(src)
    expect(screens.find((s) => s.path === '/')?.links).toContain('/instruments/$id')
  })
})
