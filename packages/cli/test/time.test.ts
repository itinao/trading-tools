import { describe, expect, it } from 'vitest'
import { isIsoDate, nowJst, todayJst } from '../src/index.ts'

describe('time', () => {
  it('nowJst は +09:00 に変換した ISO 8601', () => {
    expect(nowJst(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02T08:30:00+09:00')
  })
  it('todayJst は JST の日付', () => {
    expect(todayJst(new Date('2026-01-01T15:00:00Z'))).toBe('2026-01-02')
    expect(todayJst(new Date('2026-01-01T14:59:59Z'))).toBe('2026-01-01')
  })
  it('isIsoDate', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-2-28')).toBe(false)
    expect(isIsoDate('20260228')).toBe(false)
  })
})
