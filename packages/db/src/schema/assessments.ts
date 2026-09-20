import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { instruments } from './instruments.ts'

/**
 * ニュース・開示 1 件に対する判定。AI が付け、人が上書きできる（human を優先、ai は消さない）。
 * Design Doc 0011 §3.1 / §3.3
 */
export const assessments = sqliteTable(
  'assessments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subjectType: text('subject_type').notNull(),
    subjectId: integer('subject_id').notNull(),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    relevance: text('relevance').notNull(),
    sentiment: integer('sentiment').notNull(),
    impact: integer('impact').notNull(),
    direction: text('direction'),
    summary: text('summary').notNull(),
    rationale: text('rationale').notNull(),
    author: text('author').notNull(),
    model: text('model'),
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('assessments_subject_author').on(t.subjectType, t.subjectId, t.author),
    index('assessments_instrument_created').on(t.instrumentId, t.createdAt),
  ],
)

export type Assessment = typeof assessments.$inferSelect
export type NewAssessment = typeof assessments.$inferInsert
export type SubjectType = 'news' | 'disclosure'
export type Relevance = 'relevant' | 'irrelevant'
export type Direction = 'up' | 'down' | 'none'
export type AssessmentAuthor = 'ai' | 'human'
