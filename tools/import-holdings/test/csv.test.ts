import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/csv.ts'

describe('parseCsv', () => {
  it('CRLF、引用符付きのカンマ、二重引用符', () => {
    expect(parseCsv('a,"1,234",c\r\n"x""y",,\r\n')).toEqual([
      ['a', '1,234', 'c'],
      ['x"y', '', ''],
    ])
  })
  it('空行は空文字1要素の行になる', () => {
    expect(parseCsv('a\r\n\r\nb\r\n')).toEqual([['a'], [''], ['b']])
  })
  it('引用符内の改行', () => {
    expect(parseCsv('"a\r\nb",c')).toEqual([['a\r\nb', 'c']])
  })
})
