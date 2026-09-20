import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/** ニュースの見出し。本文は持たない。Design Doc 0010 §3.3 */
export const newsItems = sqliteTable(
  'news_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    publishedAt: text('published_at').notNull(),
    title: text('title').notNull(),
    url: text('url').notNull(),
    publisher: text('publisher'),
    source: text('source').notNull(),
    fetchedAt: text('fetched_at').notNull(),
  },
  (t) => [
    uniqueIndex('news_items_instrument_url').on(t.instrumentId, t.url),
    index('news_items_instrument_published').on(t.instrumentId, t.publishedAt),
  ],
)

export type NewsItem = typeof newsItems.$inferSelect
export type NewNewsItem = typeof newsItems.$inferInsert
