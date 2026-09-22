/** MCP のツールの戻り値。構造化データ（structuredContent）と、読み上げ用の JSON の両方を返す */
export function result(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  }
}

/** 銘柄コード（4 桁、英字を含む）を検証して instruments.id にする */
export function instrumentIdOf(code: string): string {
  const c = code.trim().toUpperCase()
  if (!/^\d[0-9A-Z]{3}$/.test(c)) throw new Error(`証券コードは 4 桁: ${code}`)
  return `JP:${c}`
}
