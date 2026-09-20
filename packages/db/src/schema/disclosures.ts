import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/** 適時開示。category は表題から機械的に付ける。上方 / 下方は持たない（0011 で AI が読む）。Design Doc 0010 §3.3 */
export const disclosures = sqliteTable(
  'disclosures',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    disclosedAt: text('disclosed_at').notNull(),
    title: text('title').notNull(),
    pdfUrl: text('pdf_url').notNull(),
    category: text('category').notNull(),
    hasXbrl: integer('has_xbrl').notNull(),
    source: text('source').notNull(),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [
    uniqueIndex('disclosures_instrument_pdf').on(t.instrumentId, t.pdfUrl),
    index('disclosures_instrument_disclosed').on(t.instrumentId, t.disclosedAt),
  ],
)

export type Disclosure = typeof disclosures.$inferSelect
export type NewDisclosure = typeof disclosures.$inferInsert
export type DisclosureCategory = 'earnings' | 'forecast_revision' | 'dividend' | 'other'
