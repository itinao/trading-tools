import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { migrate, migrationStatus, openDatabase } from '../src/index.ts'
import { createTestDatabase } from '../src/testing.ts'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('openDatabase', () => {
  it('ファイルと親ディレクトリを作り、PRAGMA を設定する', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trading-db-'))
    dirs.push(dir)
    const handle = openDatabase(join(dir, 'nested', 'trading.db'))
    expect(handle.sqlite.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(handle.sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
    handle.close()
  })
})

describe('migrate', () => {
  it('何度呼んでも pending が空で、2回目は newlyApplied が空', () => {
    const handle = openDatabase(':memory:')
    const first = migrate(handle)
    expect(first.pending).toEqual([])
    const second = migrate(handle)
    expect(second.newlyApplied).toEqual([])
    expect(migrationStatus(handle).pending).toEqual([])
    handle.close()
  })
})

describe('createTestDatabase', () => {
  it('マイグレーション済みのメモリ DB を返す', () => {
    const handle = createTestDatabase()
    expect(handle.path).toBe(':memory:')
    expect(migrationStatus(handle).pending).toEqual([])
    handle.close()
  })
})
