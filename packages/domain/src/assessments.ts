import { nowJst } from '@trading/cli'
import { schema, type TradingDatabase } from '@trading/db'
import type {
  Assessment,
  AssessmentAuthor,
  Direction,
  Relevance,
  SubjectType,
} from '@trading/db/schema'
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { monitoredInstruments } from './monitored.ts'

export type { Assessment, AssessmentAuthor, Direction, Relevance, SubjectType }

export const SUBJECT_TYPES: readonly SubjectType[] = ['news', 'disclosure']
export const RELEVANCES: readonly Relevance[] = ['relevant', 'irrelevant']
export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'none']

/** 未判定のニュース・開示。開示を先に、次にニュースを新しい順に */
export interface PendingSubject {
  kind: SubjectType
  id: number
  instrumentId: string
  code: string
  name: string
  title: string
  at: string
  category?: string
  pdfUrl?: string
  publisher?: string | null
  url?: string
}

export function pendingSubjects(
  db: TradingDatabase,
  options: { kind?: SubjectType; limit?: number } = {},
): { items: PendingSubject[]; remaining: number } {
  const held = new Map(monitoredInstruments(db).map((m) => [m.instrumentId, m]))
  const assessed = new Set(
    db
      .select({ t: schema.assessments.subjectType, id: schema.assessments.subjectId })
      .from(schema.assessments)
      .all()
      .map((a) => `${a.t}:${a.id}`),
  )
  const items: PendingSubject[] = []
  if (options.kind !== 'news') {
    for (const d of db
      .select()
      .from(schema.disclosures)
      .orderBy(desc(schema.disclosures.disclosedAt), desc(schema.disclosures.id))
      .all()) {
      const p = held.get(d.instrumentId)
      if (!p || assessed.has(`disclosure:${d.id}`)) continue
      items.push({
        kind: 'disclosure',
        id: d.id,
        instrumentId: d.instrumentId,
        code: p.code,
        name: p.name,
        title: d.title,
        at: d.disclosedAt,
        category: d.category,
        pdfUrl: d.pdfUrl,
      })
    }
  }
  if (options.kind !== 'disclosure') {
    for (const n of db
      .select()
      .from(schema.newsItems)
      .orderBy(desc(schema.newsItems.publishedAt), desc(schema.newsItems.id))
      .all()) {
      const p = held.get(n.instrumentId)
      if (!p || assessed.has(`news:${n.id}`)) continue
      items.push({
        kind: 'news',
        id: n.id,
        instrumentId: n.instrumentId,
        code: p.code,
        name: p.name,
        title: n.title,
        at: n.publishedAt,
        publisher: n.publisher,
        url: n.url,
      })
    }
  }
  const limit = options.limit ?? 50
  return { items: items.slice(0, limit), remaining: Math.max(0, items.length - limit) }
}

export interface AssessmentInput {
  kind: SubjectType
  id: number
  relevance: Relevance
  sentiment: number
  impact: number
  direction?: Direction
  summary: string
  rationale: string
  author: AssessmentAuthor
  model?: string
  note?: string
}

export function validateAssessmentInput(
  raw: unknown,
  index: number,
): { ok: true; value: AssessmentInput } | { ok: false; error: string } {
  const r = raw as Record<string, unknown>
  const err = (m: string) => ({ ok: false as const, error: `[${index}] ${m}` })
  if (typeof r !== 'object' || r === null) return err('オブジェクトではありません')
  if (!SUBJECT_TYPES.includes(r.kind as SubjectType))
    return err(`kind は ${SUBJECT_TYPES.join(' | ')}`)
  if (!Number.isInteger(r.id) || (r.id as number) <= 0) return err('id は正の整数')
  if (!RELEVANCES.includes(r.relevance as Relevance))
    return err(`relevance は ${RELEVANCES.join(' | ')}`)
  if (!Number.isInteger(r.sentiment) || (r.sentiment as number) < -2 || (r.sentiment as number) > 2)
    return err('sentiment は -2..2 の整数')
  if (!Number.isInteger(r.impact) || (r.impact as number) < 1 || (r.impact as number) > 3)
    return err('impact は 1..3 の整数')
  if (r.direction !== undefined && !DIRECTIONS.includes(r.direction as Direction))
    return err(`direction は ${DIRECTIONS.join(' | ')}`)
  if (typeof r.summary !== 'string' || r.summary.trim() === '')
    return err('summary は空でない文字列')
  if (typeof r.rationale !== 'string' || r.rationale.trim() === '')
    return err('rationale は空でない文字列（引用）')
  const author = (r.author ?? 'ai') as AssessmentAuthor
  if (author !== 'ai' && author !== 'human') return err('author は ai | human')
  const value: AssessmentInput = {
    kind: r.kind as SubjectType,
    id: r.id as number,
    relevance: r.relevance as Relevance,
    sentiment: r.sentiment as number,
    impact: r.impact as number,
    summary: (r.summary as string).trim(),
    rationale: (r.rationale as string).trim(),
    author,
  }
  if (r.direction !== undefined) value.direction = r.direction as Direction
  if (typeof r.model === 'string') value.model = r.model
  if (typeof r.note === 'string') value.note = r.note
  return { ok: true, value }
}

/** 判定を書き込む。対象が存在しなければ失敗。同じ (subject, author) は上書き */
export function recordAssessments(
  db: TradingDatabase,
  inputs: AssessmentInput[],
): { written: number; ids: number[] } {
  const now = nowJst()
  const ids: number[] = []
  db.transaction((tx) => {
    for (const a of inputs) {
      const subject =
        a.kind === 'news'
          ? tx
              .select({ instrumentId: schema.newsItems.instrumentId })
              .from(schema.newsItems)
              .where(eq(schema.newsItems.id, a.id))
              .get()
          : tx
              .select({ instrumentId: schema.disclosures.instrumentId })
              .from(schema.disclosures)
              .where(eq(schema.disclosures.id, a.id))
              .get()
      if (!subject) throw new Error(`${a.kind} ${a.id} はありません`)
      const row = tx
        .insert(schema.assessments)
        .values({
          subjectType: a.kind,
          subjectId: a.id,
          instrumentId: subject.instrumentId,
          relevance: a.relevance,
          sentiment: a.sentiment,
          impact: a.impact,
          direction: a.direction ?? null,
          summary: a.summary,
          rationale: a.rationale,
          author: a.author,
          model: a.model ?? null,
          note: a.note ?? null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [
            schema.assessments.subjectType,
            schema.assessments.subjectId,
            schema.assessments.author,
          ],
          set: {
            relevance: sql`excluded.relevance`,
            sentiment: sql`excluded.sentiment`,
            impact: sql`excluded.impact`,
            direction: sql`excluded.direction`,
            summary: sql`excluded.summary`,
            rationale: sql`excluded.rationale`,
            model: sql`excluded.model`,
            note: sql`excluded.note`,
            createdAt: sql`excluded.created_at`,
          },
        })
        .returning({ id: schema.assessments.id })
        .get()
      if (row) ids.push(row.id)
    }
  })
  return { written: ids.length, ids }
}

/** 有効な判定 = human があればそれ、無ければ ai。対象ごとに 1 件 */
export function effectiveAssessments(
  db: TradingDatabase,
  filter: { instrumentId?: string; instrumentIds?: string[]; since?: string } = {},
): Assessment[] {
  const conds = []
  if (filter.instrumentId) conds.push(eq(schema.assessments.instrumentId, filter.instrumentId))
  if (filter.instrumentIds)
    conds.push(inArray(schema.assessments.instrumentId, filter.instrumentIds))
  if (filter.since) conds.push(gte(schema.assessments.createdAt, filter.since))
  const rows = db
    .select()
    .from(schema.assessments)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(schema.assessments.createdAt))
    .all()
  const byKey = new Map<string, Assessment>()
  for (const a of rows) {
    const key = `${a.subjectType}:${a.subjectId}`
    const cur = byKey.get(key)
    if (!cur || (cur.author === 'ai' && a.author === 'human')) byKey.set(key, a)
  }
  return [...byKey.values()]
}

export function getAssessment(db: TradingDatabase, id: number): Assessment | undefined {
  return db.select().from(schema.assessments).where(eq(schema.assessments.id, id)).get()
}
