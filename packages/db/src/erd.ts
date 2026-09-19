import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from './schema/index.ts'

/** 各テーブルを定義した Design Doc。新しいテーブルを足したらここにも足す */
const DEFINED_IN: Record<string, string> = {
  instruments: '0003',
  holding_snapshots: '0003',
  holdings: '0003',
  quotes: '0003',
  signals: '0005',
  actions: '0005',
}

function isTable(value: unknown): value is SQLiteTable {
  return typeof value === 'object' && value !== null && Symbol.for('drizzle:Name') in value
}

function sqlType(column: { getSQLType(): string }): string {
  return column.getSQLType()
}

/** Drizzle スキーマから Mermaid の erDiagram を生成する */
export function renderErd(): string {
  const tables = (Object.values(schema) as unknown[]).filter(isTable).map((t) => getTableConfig(t))
  tables.sort((a, b) => a.name.localeCompare(b.name))

  const lines: string[] = ['erDiagram']
  const relations: string[] = []
  for (const table of tables) {
    const pkColumns = new Set(table.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)))
    const fkColumns = new Map<string, string>()
    for (const fk of table.foreignKeys) {
      const ref = fk.reference()
      const target = getTableConfig(ref.foreignTable).name
      for (const c of ref.columns) fkColumns.set(c.name, target)
      relations.push(`    ${target} ||--o{ ${table.name} : ""`)
    }
    const uniqueColumns = new Map<string, string>()
    for (const idx of table.indexes) {
      if (!idx.config.unique) continue
      const cols = idx.config.columns.map((c) => ('name' in c ? String(c.name) : '')).join(', ')
      for (const c of idx.config.columns) if ('name' in c) uniqueColumns.set(String(c.name), cols)
    }

    lines.push(`    ${table.name} {`)
    for (const column of table.columns) {
      const keys: string[] = []
      if (column.primary || pkColumns.has(column.name)) keys.push('PK')
      if (fkColumns.has(column.name)) keys.push('FK')
      const notes: string[] = []
      if (fkColumns.has(column.name)) notes.push(`-> ${fkColumns.get(column.name)}`)
      if (uniqueColumns.has(column.name)) notes.push(`unique(${uniqueColumns.get(column.name)})`)
      if (!column.notNull && !column.primary) notes.push('nullable')
      const key = keys.length > 0 ? ` ${keys.join(',')}` : ''
      const note = notes.length > 0 ? ` "${notes.join('; ')}"` : ''
      lines.push(`        ${sqlType(column)} ${column.name}${key}${note}`)
    }
    lines.push('    }')
  }
  lines.push(...[...new Set(relations)].sort())
  return lines.join('\n')
}

function designDocLink(number: string, designDocsDir: string): string {
  const file = readdirSync(designDocsDir).find(
    (f) => f.startsWith(`${number}-`) && f.endsWith('.md'),
  )
  return file ? `[${number}](design-docs/${file})` : number
}

export function renderSchemaDoc(docsDir: string): string {
  const designDocsDir = join(docsDir, 'design-docs')
  const tables = (Object.values(schema) as unknown[])
    .filter(isTable)
    .map((t) => getTableConfig(t).name)
    .sort()
  const rows = tables.map((name) => {
    const doc = DEFINED_IN[name]
    return `| \`${name}\` | ${doc ? designDocLink(doc, designDocsDir) : '（未記載）'} |`
  })
  return [
    '# データストアのスキーマ（現在）',
    '',
    '**このファイルは自動生成。手で編集しない。** 生成元は `packages/db/src/schema/`、生成コマンドは `pnpm db:erd`。',
    '古くなっていると `pnpm test` が落ちる。各テーブルの設計意図は、定義した Design Doc を参照。',
    '',
    '| テーブル | 定義した Design Doc |',
    '| --- | --- |',
    ...rows,
    '',
    '```mermaid',
    renderErd(),
    '```',
    '',
  ].join('\n')
}
