import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fetchJpxListing, JpxFormatError, parseJpxListing } from '../src/index.ts'

const bytes = () =>
  new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', 'jpx-listing.xlsx')))

describe('parseJpxListing', () => {
  it('市場区分を正規化し、コード・名前・業種・規模を取り出す', async () => {
    const rows = await parseJpxListing(bytes())
    expect(rows).toHaveLength(4)
    expect(rows[0]).toEqual({
      code: '1234',
      name: 'テスト製作所',
      segment: 'prime',
      segmentRaw: 'プライム（内国株式）',
      sector33: '輸送用機器',
      size: 'TOPIX Core30',
      listedAsOf: '2026-08-31',
    })
    expect(rows[1]).toMatchObject({ code: '5678', segment: 'standard', size: null })
    expect(rows[2]).toMatchObject({ code: '264A', segment: 'growth' })
    expect(rows[3]).toMatchObject({ code: '1306', segment: 'other', sector33: null })
  })
  it('列が違えば JpxFormatError', async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet([{ code: 1, name: 'x' }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'S')
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    await expect(parseJpxListing(new Uint8Array(out))).rejects.toThrow(JpxFormatError)
  })
})

describe('fetchJpxListing', () => {
  it('HTTP エラーは例外', async () => {
    await expect(
      fetchJpxListing({
        fetch: async () => ({
          ok: false,
          status: 404,
          arrayBuffer: async () => new ArrayBuffer(0),
        }),
      }),
    ).rejects.toThrow(/404/)
  })
})
