import { DEFAULT_HEADERS, type FetchLike } from './provider.ts'

/** PDF を取得して本文を抽出する（unpdf、純 JS）。Design Doc 0011 §3.1 */
export interface PdfTextOptions {
  fetch?: (
    url: string,
    init?: { headers?: Record<string, string> },
  ) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>
  /** 返す最大文字数。既定 8000 */
  maxChars?: number
}

export async function extractPdfText(
  bytes: Uint8Array,
  maxChars = 8000,
): Promise<{ pages: number; text: string; truncated: boolean }> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(bytes)
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  const normalized = text
    .replace(/[ \t　]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
  return {
    pages: totalPages,
    text: normalized.slice(0, maxChars),
    truncated: normalized.length > maxChars,
  }
}

export async function fetchPdfText(
  url: string,
  options: PdfTextOptions = {},
): Promise<{ pages: number; text: string; truncated: boolean }> {
  const doFetch = options.fetch ?? (fetch as unknown as NonNullable<PdfTextOptions['fetch']>)
  const res = await doFetch(url, { headers: DEFAULT_HEADERS })
  if (!res.ok) throw new Error(`pdf: HTTP ${res.status}`)
  return extractPdfText(new Uint8Array(await res.arrayBuffer()), options.maxChars)
}

export type { FetchLike }
