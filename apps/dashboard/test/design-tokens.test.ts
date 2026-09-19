import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseFrontMatter,
  renderTokensCss,
  renderTokensFromFile,
} from '../src/app/design-tokens.ts'

const root = join(import.meta.dirname, '..')

describe('design tokens', () => {
  it('tokens.css は DESIGN.md から生成した内容と一致する（違えば pnpm design:tokens）', () => {
    const committed = readFileSync(join(root, 'src', 'app', 'tokens.css'), 'utf8')
    expect(committed).toBe(renderTokensFromFile(join(root, 'DESIGN.md')))
  })

  it('DEFAULT は接尾辞なし、数値の spacing は px', () => {
    const css = renderTokensCss(
      parseFrontMatter(
        '---\nrounded:\n  DEFAULT: 6px\n  sm: 4px\nspacing:\n  unit: 4\n---\n## Overview\n',
      ),
    )
    expect(css).toContain('--rounded: 6px;')
    expect(css).toContain('--rounded-sm: 4px;')
    expect(css).toContain('--spacing-unit: 4px;')
  })

  it('DESIGN.md の必須トークンが揃っている', () => {
    const fm = parseFrontMatter(readFileSync(join(root, 'DESIGN.md'), 'utf8'))
    for (const c of ['background', 'surface', 'primary', 'gain', 'loss', 'warn', 'critical']) {
      expect(fm.colors?.[c], c).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
    expect(Object.keys(fm.typography ?? {})).toEqual(
      expect.arrayContaining(['headline-md', 'body-md', 'label-sm', 'numeric-md']),
    )
  })
})
