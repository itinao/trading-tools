import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { screenRuns } from './screen-runs.ts'

/** スクリーニングの結果（絞り込み後の銘柄と、その時点の指標）。Design Doc 0013 §3.5 */
export const screenResults = sqliteTable(
  'screen_results',
  {
    runId: integer('run_id')
      .notNull()
      .references(() => screenRuns.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    segment: text('segment').notNull(),
    sector33: text('sector33'),
    price: real('price'),
    per: real('per'),
    forwardPer: real('forward_per'),
    pbr: real('pbr'),
    dividendYield: real('dividend_yield'),
    marketCap: real('market_cap'),
    growthYears: integer('growth_years'),
    rank: integer('rank').notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.code] })],
)

export type ScreenResult = typeof screenResults.$inferSelect
