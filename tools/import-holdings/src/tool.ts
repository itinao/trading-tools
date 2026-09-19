import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { defineTool, findWorkspaceRoot, nowJst, type ToolContext, ToolError } from '@trading/cli'
import { type DatabaseHandle, openDatabase, schema } from '@trading/db'
import { and, desc, eq } from 'drizzle-orm'
import {
  asOfFromFileName,
  decodeShiftJis,
  parseRakutenHoldings,
  RakutenFormatError,
  type RakutenParseResult,
} from './rakuten.ts'

const SOURCE = 'rakuten'
const MARKET = 'JP'

interface RunOptions {
  replace: boolean
}

function withDatabase<T>(context: ToolContext, fn: (handle: DatabaseHandle) => T): T {
  const handle = openDatabase(context.dbPath)
  try {
    return fn(handle)
  } finally {
    handle.close()
  }
}

/** CSV を読んでパースする。DB には触らない */
export function loadRakutenCsv(path: string): {
  asOf: string
  fileName: string
  parsed: RakutenParseResult
} {
  const fileName = basename(path)
  const asOf = asOfFromFileName(path)
  if (!asOf) {
    throw new ToolError('bad_filename', `ファイル名から日時を取れません: ${fileName}`, {
      details: { expected: 'assetbalance(all)_YYYYMMDD_HHMMSS.csv' },
    })
  }
  let bytes: Uint8Array
  try {
    bytes = readFileSync(path)
  } catch {
    throw new ToolError('file_not_found', `ファイルを読めません: ${path}`)
  }
  try {
    return { asOf, fileName, parsed: parseRakutenHoldings(decodeShiftJis(bytes)) }
  } catch (error) {
    if (error instanceof RakutenFormatError) {
      throw new ToolError('unexpected_format', error.message, { details: error.details })
    }
    throw error
  }
}

export function importSnapshot(
  handle: DatabaseHandle,
  input: { asOf: string; fileName: string; parsed: RakutenParseResult; replace: boolean },
): { snapshotId: number; imported: number; instrumentsCreated: number } {
  const { db } = handle
  const now = nowJst()
  return db.transaction((tx) => {
    const existing = tx
      .select({ id: schema.holdingSnapshots.id })
      .from(schema.holdingSnapshots)
      .where(
        and(
          eq(schema.holdingSnapshots.source, SOURCE),
          eq(schema.holdingSnapshots.asOf, input.asOf),
        ),
      )
      .get()
    if (existing) {
      if (!input.replace) {
        throw new ToolError(
          'already_imported',
          `同じ日時のスナップショットがあります（id=${existing.id}）。入れ直すには --replace`,
          {
            details: { snapshotId: existing.id, asOf: input.asOf },
          },
        )
      }
      // holdings は ON DELETE CASCADE
      tx.delete(schema.holdingSnapshots).where(eq(schema.holdingSnapshots.id, existing.id)).run()
    }

    let instrumentsCreated = 0
    for (const row of input.parsed.rows) {
      const id = schema.instrumentId(MARKET, row.code)
      const found = tx
        .select({ id: schema.instruments.id })
        .from(schema.instruments)
        .where(eq(schema.instruments.id, id))
        .get()
      if (found) {
        tx.update(schema.instruments)
          .set({ name: row.name, updatedAt: now })
          .where(eq(schema.instruments.id, id))
          .run()
      } else {
        tx.insert(schema.instruments)
          .values({
            id,
            market: MARKET,
            code: row.code,
            name: row.name,
            createdAt: now,
            updatedAt: now,
          })
          .run()
        instrumentsCreated++
      }
    }

    const snapshot = tx
      .insert(schema.holdingSnapshots)
      .values({
        source: SOURCE,
        asOf: input.asOf,
        fileName: input.fileName,
        importedAt: now,
        rowCount: input.parsed.rows.length,
        skippedJson: JSON.stringify(input.parsed.skipped),
      })
      .returning({ id: schema.holdingSnapshots.id })
      .get()
    if (!snapshot) throw new ToolError('internal', 'スナップショットを作れませんでした')

    if (input.parsed.rows.length > 0) {
      tx.insert(schema.holdings)
        .values(
          input.parsed.rows.map((row) => ({
            snapshotId: snapshot.id,
            instrumentId: schema.instrumentId(MARKET, row.code),
            account: row.account,
            quantity: row.quantity,
            averageCost: row.averageCost,
            priceAtSnapshot: row.price,
            marketValue: row.marketValue,
            unrealizedPnl: row.unrealizedPnl,
            unrealizedPnlPct: row.unrealizedPnlPct,
          })),
        )
        .run()
    }
    return { snapshotId: snapshot.id, imported: input.parsed.rows.length, instrumentsCreated }
  })
}

export const tool = defineTool({
  name: 'import-holdings',
  description: '楽天証券の保有状況 CSV を保有スナップショットとして取り込む',
  commands: [
    {
      name: 'run',
      description: 'CSV を取り込む',
      configure: (c) =>
        c
          .argument('<csv-path>', 'assetbalance(all)_YYYYMMDD_HHMMSS.csv')
          .option('--replace', '同じ日時のスナップショットがあれば入れ直す', false),
      handler: (options: RunOptions, context, [csvPath]) => {
        const path = resolve(findWorkspaceRoot(), csvPath as string)
        const loaded = loadRakutenCsv(path)
        const base = {
          asOf: loaded.asOf,
          fileName: loaded.fileName,
          skipped: loaded.parsed.skipped,
        }
        context.logger.info(
          `${loaded.fileName}: 国内株式 ${loaded.parsed.rows.length} 行、読み飛ばし ${JSON.stringify(loaded.parsed.skipped)}`,
        )
        if (context.options.dryRun) {
          return { ...base, imported: loaded.parsed.rows.length, dryRun: true }
        }
        return withDatabase(context, (handle) => {
          const result = importSnapshot(handle, { ...loaded, replace: options.replace })
          return {
            snapshotId: result.snapshotId,
            ...base,
            imported: result.imported,
            instrumentsCreated: result.instrumentsCreated,
          }
        })
      },
    },
    {
      name: 'list',
      description: '取り込み済みスナップショットの一覧',
      handler: (_options, context) =>
        withDatabase(context, (handle) =>
          handle.db
            .select({
              id: schema.holdingSnapshots.id,
              asOf: schema.holdingSnapshots.asOf,
              importedAt: schema.holdingSnapshots.importedAt,
              rowCount: schema.holdingSnapshots.rowCount,
              fileName: schema.holdingSnapshots.fileName,
            })
            .from(schema.holdingSnapshots)
            .orderBy(desc(schema.holdingSnapshots.asOf))
            .all(),
        ),
    },
  ],
})
