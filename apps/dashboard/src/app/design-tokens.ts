import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

/**
 * DESIGN.md（Stitch フォーマット）の front matter を CSS 変数に変換する（Design Doc 0007 §3.2）。
 * components は複合値なので変換せず、styles.css に手書きする。
 */

interface Typography {
  fontFamily: string
  fontSize: string
  fontWeight: string | number
  lineHeight: string | number
  letterSpacing?: string
  fontFeature?: string
}

interface FrontMatter {
  name?: string
  colors?: Record<string, string>
  typography?: Record<string, Typography>
  rounded?: Record<string, string>
  spacing?: Record<string, string | number>
}

export function parseFrontMatter(markdown: string): FrontMatter {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (!m) throw new Error('DESIGN.md に front matter がありません')
  return parse(m[1] as string) as FrontMatter
}

const varName = (group: string, key: string) =>
  `--${group}-${key === 'DEFAULT' ? '' : key}`.replace(/-$/, '')

export function renderTokensCss(fm: FrontMatter): string {
  const lines: string[] = []
  const section = (title: string, entries: string[]) => {
    if (entries.length === 0) return
    lines.push(`  /* ${title} */`, ...entries, '')
  }
  section(
    'colors',
    Object.entries(fm.colors ?? {}).map(([k, v]) => `  ${varName('color', k)}: ${v};`),
  )
  section(
    'typography',
    Object.entries(fm.typography ?? {}).flatMap(([k, t]) => {
      const out = [
        `  --font-${k}-family: ${t.fontFamily};`,
        `  --font-${k}-size: ${t.fontSize};`,
        `  --font-${k}-weight: ${t.fontWeight};`,
        `  --font-${k}-line-height: ${t.lineHeight};`,
        `  --font-${k}-letter-spacing: ${t.letterSpacing ?? '0'};`,
      ]
      if (t.fontFeature) out.push(`  --font-${k}-feature: ${t.fontFeature};`)
      return out
    }),
  )
  section(
    'rounded',
    Object.entries(fm.rounded ?? {}).map(([k, v]) => `  ${varName('rounded', k)}: ${v};`),
  )
  section(
    'spacing',
    Object.entries(fm.spacing ?? {}).map(
      ([k, v]) => `  ${varName('spacing', k)}: ${typeof v === 'number' ? `${v}px` : v};`,
    ),
  )
  return [
    '/* 自動生成。手で編集しない。生成元は DESIGN.md、コマンドは pnpm design:tokens（Design Doc 0007） */',
    ':root {',
    ...lines,
    '}',
    '',
  ].join('\n')
}

export function renderTokensFromFile(designMdPath: string): string {
  return renderTokensCss(parseFrontMatter(readFileSync(designMdPath, 'utf8')))
}
