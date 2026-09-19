import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderTokensFromFile } from '../src/app/design-tokens.ts'

const root = join(import.meta.dirname, '..')
const out = join(root, 'src', 'app', 'tokens.css')
writeFileSync(out, renderTokensFromFile(join(root, 'DESIGN.md')))
console.error(`wrote ${out}`)
