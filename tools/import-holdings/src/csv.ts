/**
 * RFC 4180 相当の最小 CSV パーサ。引用符内のカンマ・改行・二重引用符に対応。
 * 楽天証券の CSV は "1,234" のように数値が引用されるため必要。
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  while (i < text.length) {
    const ch = text[i] as string
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      quoted = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1
      continue
    }
    field += ch
    i++
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // 末尾の完全な空行は落とす。空行 [''] は呼び出し側で判定できるよう残す
  return rows
}
