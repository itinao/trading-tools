import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@trading/cli'
import { describe, expect, it } from 'vitest'
import { renderSchemaDoc } from '../src/erd.ts'

describe('docs/schema.md', () => {
  it('スキーマから生成した内容と一致する（違えば pnpm db:erd を実行する）', () => {
    const docsDir = join(findWorkspaceRoot(), 'docs')
    const committed = readFileSync(join(docsDir, 'schema.md'), 'utf8')
    expect(committed).toBe(renderSchemaDoc(docsDir))
  })
})
