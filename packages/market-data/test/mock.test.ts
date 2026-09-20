import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createMockProvider } from '../src/index.ts'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'mock-quotes-'))
  dirs.push(d)
  return join(d, 'nested', 'mock-quotes.json')
}

describe('mock provider', () => {
  it('ファイルがなければ seed から生成して返す', async () => {
    const filePath = tmp()
    const p = createMockProvider({ filePath, seed: () => ({ '1234': 2500, '5678': 700.5 }) })
    const r = await p.fetchQuotes(['1234', '5678', '9999'])
    expect(r).toEqual([
      { code: '1234', ok: true, price: 2500 },
      { code: '5678', ok: true, price: 700.5 },
      { code: '9999', ok: false, reason: 'not in mock data' },
    ])
    expect(existsSync(filePath)).toBe(true)
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual({
      '1234': { price: 2500 },
      '5678': { price: 700.5 },
    })
  })

  it('ファイルがあればそれを使い、seed は呼ばない', async () => {
    const filePath = tmp()
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify({ '1234': { price: 2000, previousClose: 2500 } }))
    const p = createMockProvider({
      filePath,
      seed: () => {
        throw new Error('should not seed')
      },
    })
    expect(await p.fetchQuotes(['1234'])).toEqual([
      { code: '1234', ok: true, price: 2000, previousClose: 2500 },
    ])
  })
})
