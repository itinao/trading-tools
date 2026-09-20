import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { QuoteProvider, QuoteResult } from './provider.ts'

export interface MockQuote {
  price: number
  previousClose?: number
}
export type MockQuoteFile = Record<string, MockQuote>

export interface MockProviderOptions {
  /** 利用者が編集する JSON。既定は data/source/mock-quotes.json */
  filePath: string
  /** ファイルがないときの初期値。code → price */
  seed?: () => Record<string, number>
}

/**
 * JSON ファイルの値を返すモック。ファイルがなければ seed から生成する。
 * 利用者はファイルの値を書き換えて「下落した状態」を作れる。
 */
export function createMockProvider(
  options: MockProviderOptions,
): QuoteProvider & { filePath: string } {
  return {
    name: 'mock',
    filePath: options.filePath,
    async fetchQuotes(codes) {
      // モックは as_of を返さない（collect 側で実行日を使う）
      const data = loadOrSeed(options)
      return codes.map<QuoteResult>((code) => {
        const q = data[code]
        if (!q || typeof q.price !== 'number')
          return { code, ok: false, reason: 'not in mock data' }
        return q.previousClose === undefined
          ? { code, ok: true, price: q.price }
          : { code, ok: true, price: q.price, previousClose: q.previousClose }
      })
    },
  }
}

function loadOrSeed(options: MockProviderOptions): MockQuoteFile {
  if (existsSync(options.filePath)) {
    return JSON.parse(readFileSync(options.filePath, 'utf8')) as MockQuoteFile
  }
  const seed = options.seed?.() ?? {}
  const data: MockQuoteFile = Object.fromEntries(
    Object.entries(seed).map(([code, price]) => [code, { price }]),
  )
  mkdirSync(dirname(options.filePath), { recursive: true })
  writeFileSync(options.filePath, `${JSON.stringify(data, null, 2)}\n`)
  return data
}
