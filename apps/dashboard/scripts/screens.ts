import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@trading/cli'
import { renderScreensDoc } from '../src/app/screens.ts'

const out = join(findWorkspaceRoot(), 'docs', 'screens.md')
writeFileSync(out, renderScreensDoc(join(import.meta.dirname, '..', 'src')))
console.error(`wrote ${out}`)
