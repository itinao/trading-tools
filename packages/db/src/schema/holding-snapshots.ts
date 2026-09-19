import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** 1回の CSV 取り込み = 1スナップショット。(source, as_of) で一意 */
export const holdingSnapshots = sqliteTable(
  'holding_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull(),
    asOf: text('as_of').notNull(),
    fileName: text('file_name').notNull(),
    importedAt: text('imported_at').notNull(),
    rowCount: integer('row_count').notNull(),
    /** 種別ごとの読み飛ばし件数。例 {"投資信託":19} */
    skippedJson: text('skipped_json').notNull(),
  },
  (t) => [uniqueIndex('holding_snapshots_source_as_of').on(t.source, t.asOf)],
)

export type HoldingSnapshot = typeof holdingSnapshots.$inferSelect
export type NewHoldingSnapshot = typeof holdingSnapshots.$inferInsert
