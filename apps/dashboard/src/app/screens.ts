import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * routes/ と <Link to> から画面遷移図を生成する（Design Doc 0008）。
 * ルートファイルから相対 import を辿り、to="/…" の文字列リテラルを遷移とみなす。
 */

export interface Screen {
  path: string
  routeFile: string
  pageSlice: string | null
  description: string | null
  links: string[]
}

const ROUTE_RE = /createFileRoute\('([^']+)'\)/
const IMPORT_RE = /from\s+'(\.{1,2}\/[^']+)'/g
const LINK_RE = /\bto=(?:"([^"]+)"|\{'([^']+)'\})/g
const JSDOC_RE = /\/\*\*\s*([^\n*]+?)\s*\*\//

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.endsWith('.css')) return null
  const base = resolve(dirname(fromFile), spec)
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/** ファイルから相対 import を再帰的に辿り、到達したファイルの集合を返す */
function reachableFiles(entry: string): string[] {
  const seen = new Set<string>()
  const stack = [entry]
  while (stack.length > 0) {
    const file = stack.pop() as string
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(IMPORT_RE)) {
      const target = resolveImport(file, m[1] as string)
      if (target && !seen.has(target)) stack.push(target)
    }
  }
  return [...seen]
}

/** __root.tsx から辿れるリンク = すべての画面に共通のナビゲーション */
export function collectGlobalLinks(srcDir: string): string[] {
  const root = join(srcDir, 'routes', '__root.tsx')
  if (!existsSync(root)) return []
  const links = new Set<string>()
  for (const f of reachableFiles(root)) {
    for (const m of readFileSync(f, 'utf8').matchAll(LINK_RE)) links.add((m[1] ?? m[2]) as string)
  }
  return [...links].sort()
}

export function collectScreens(srcDir: string): Screen[] {
  const routesDir = join(srcDir, 'routes')
  const screens: Screen[] = []
  for (const name of readdirSync(routesDir).sort()) {
    if (!name.endsWith('.tsx') || name.startsWith('__')) continue
    const routeFile = join(routesDir, name)
    const text = readFileSync(routeFile, 'utf8')
    const path = ROUTE_RE.exec(text)?.[1]
    if (!path) continue
    const files = reachableFiles(routeFile)
    const links = new Set<string>()
    for (const f of files) {
      const t = readFileSync(f, 'utf8')
      for (const m of t.matchAll(LINK_RE)) links.add((m[1] ?? m[2]) as string)
    }
    const pageUi = files.find((f) => /\/pages\/[^/]+\/ui\/[^/]+Page\.tsx$/.test(f))
    const pageSlice = pageUi ? (/\/pages\/([^/]+)\//.exec(pageUi)?.[1] ?? null) : null
    const description = pageUi ? (JSDOC_RE.exec(readFileSync(pageUi, 'utf8'))?.[1] ?? null) : null
    screens.push({
      path,
      routeFile: relative(srcDir, routeFile),
      pageSlice,
      description,
      links: [...links].sort(),
    })
  }
  // '/' を先頭に、あとはパス順
  return screens.sort((a, b) =>
    a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path),
  )
}

const nodeId = (path: string) => `R${path.replace(/[^a-zA-Z0-9]/g, '_') || 'root'}`

export function renderScreensDoc(srcDir: string): string {
  const screens = collectScreens(srcDir)
  const globalLinks = collectGlobalLinks(srcDir)
  const known = new Set(screens.map((s) => s.path))
  const lines = ['flowchart LR']
  lines.push('    NAV(["共通ナビ"])')
  for (const s of screens) {
    const label = s.description
      ? `${s.path}<br><small>${s.description.split('。')[0]}</small>`
      : s.path
    lines.push(`    ${nodeId(s.path)}["${label}"]`)
  }
  for (const to of globalLinks) if (known.has(to)) lines.push(`    NAV -.-> ${nodeId(to)}`)
  const edges = new Set<string>()
  for (const s of screens) {
    for (const to of s.links) {
      if (!known.has(to)) continue
      edges.add(`    ${nodeId(s.path)} --> ${nodeId(to)}`)
    }
  }
  lines.push(...[...edges].sort())

  const rows = screens.map(
    (s) =>
      `| \`${s.path}\` | ${s.description ?? '-'} | \`${s.routeFile}\` | ${s.pageSlice ? `\`pages/${s.pageSlice}\`` : '-'} |`,
  )
  return [
    '# 画面遷移図（現在）',
    '',
    '**このファイルは自動生成。手で編集しない。** 生成元は `apps/dashboard/src/routes/` と各画面から辿れる `<Link to>`、生成コマンドは `pnpm screens`。',
    '古くなっていると `pnpm test` が落ちる。画面の目的とユーザーフローは Design Doc（0005 §3.5 など）を参照。',
    '',
    '| パス | 画面 | ルート | ページのスライス |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `共通ナビ（すべての画面のヘッダ）: ${globalLinks.map((l) => `\`${l}\``).join(', ')}`,
    '',
    '矢印は「その画面のコードから到達できる `<Link>`」。静的解析なので表示条件（props で出し分ける等）は見ない。自分自身への矢印はタブなど、同じ画面のまま条件が変わる遷移。',
    '',
    '```mermaid',
    ...lines,
    '```',
    '',
  ].join('\n')
}
