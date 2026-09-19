import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@trading/cli'
import { renderSchemaDoc } from '../src/erd.ts'

const docsDir = join(findWorkspaceRoot(), 'docs')
const out = join(docsDir, 'schema.md')
writeFileSync(out, renderSchemaDoc(docsDir))
console.error(`wrote ${out}`)
