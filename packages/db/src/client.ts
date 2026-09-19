import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate as drizzleMigrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema/index.ts'

export type TradingDatabase = ReturnType<typeof drizzle<typeof schema>>

export interface DatabaseHandle {
  db: TradingDatabase
  sqlite: Database.Database
  path: string
  close(): void
}

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

/**
 * SQLite を開く。ファイルがなければ作る（親ディレクトリも作る）。
 * PRAGMA は Design Doc 0002 §3.2 のとおり。
 */
export function openDatabase(path: string): DatabaseHandle {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  const db = drizzle(sqlite, { schema })
  return { db, sqlite, path, close: () => sqlite.close() }
}

interface JournalEntry {
  idx: number
  tag: string
  when: number
}

function readJournal(): JournalEntry[] {
  const file = join(migrationsFolder, 'meta', '_journal.json')
  if (!existsSync(file)) return []
  const journal = JSON.parse(readFileSync(file, 'utf8')) as { entries?: JournalEntry[] }
  return journal.entries ?? []
}

export interface MigrationStatus {
  applied: string[]
  pending: string[]
}

/** 適用済み・未適用のマイグレーションを journal と __drizzle_migrations から求める */
export function migrationStatus(handle: DatabaseHandle): MigrationStatus {
  const entries = readJournal()
  const hasTable = handle.sqlite
    .prepare("select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'")
    .get()
  const last = hasTable
    ? (handle.sqlite
        .prepare('select created_at from __drizzle_migrations order by created_at desc limit 1')
        .get() as { created_at: number } | undefined)
    : undefined
  const lastApplied = last?.created_at ?? -1
  const applied = entries.filter((e) => e.when <= lastApplied).map((e) => e.tag)
  const pending = entries.filter((e) => e.when > lastApplied).map((e) => e.tag)
  return { applied, pending }
}

export interface MigrateResult extends MigrationStatus {
  /** 今回の呼び出しで適用したもの */
  newlyApplied: string[]
}

/** 未適用のマイグレーションをすべて適用する。何度呼んでも安全。 */
export function migrate(handle: DatabaseHandle): MigrateResult {
  const before = migrationStatus(handle)
  drizzleMigrate(handle.db, { migrationsFolder })
  const after = migrationStatus(handle)
  return { ...after, newlyApplied: before.pending }
}
