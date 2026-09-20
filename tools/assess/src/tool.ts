import { defineTool, type ToolContext, ToolError, UsageError } from '@trading/cli'
import { type DatabaseHandle, openDatabase } from '@trading/db'
import {
  type AssessmentInput,
  DIRECTIONS,
  type Direction,
  effectiveAssessments,
  getAssessment,
  type PendingSubject,
  pendingSubjects,
  recordAssessments,
  SUBJECT_TYPES,
  type SubjectType,
  validateAssessmentInput,
} from '@trading/domain'
import { fetchPdfText } from '@trading/market-data'

function withDatabase<T>(context: ToolContext, fn: (handle: DatabaseHandle) => T): T {
  const handle = openDatabase(context.dbPath)
  try {
    return fn(handle)
  } finally {
    handle.close()
  }
}

export type PdfTextFetcher = (
  url: string,
) => Promise<{ text: string; pages: number; truncated: boolean }>

export interface PendingItem extends PendingSubject {
  text?: string
  textPages?: number
  textTruncated?: boolean
  textError?: string
}

/** 未判定の一覧。開示は PDF 本文を同梱する（Design Doc 0011 §3.2） */
export async function buildPending(
  handle: DatabaseHandle,
  options: { kind?: SubjectType; limit: number },
  pdfText: PdfTextFetcher,
): Promise<{ items: PendingItem[]; remaining: number }> {
  const { items, remaining } = pendingSubjects(handle.db, options)
  const out: PendingItem[] = []
  for (const it of items) {
    const item: PendingItem = { ...it }
    if (it.kind === 'disclosure' && it.pdfUrl) {
      try {
        const t = await pdfText(it.pdfUrl)
        item.text = t.text
        item.textPages = t.pages
        item.textTruncated = t.truncated
      } catch (e) {
        item.textError = e instanceof Error ? e.message : String(e)
      }
    }
    out.push(item)
  }
  return { items: out, remaining }
}

export function parseRecordInput(raw: unknown): AssessmentInput[] {
  if (!Array.isArray(raw)) throw new UsageError('--input は判定の配列です')
  const errors: string[] = []
  const values: AssessmentInput[] = []
  raw.forEach((r, i) => {
    const v = validateAssessmentInput(r, i)
    if (v.ok) values.push(v.value)
    else errors.push(v.error)
  })
  if (errors.length > 0)
    throw new ToolError(
      'invalid_input',
      `${errors.length} 件の判定が不正です。1 件も書き込みません`,
      { details: errors },
    )
  return values
}

export const tool = defineTool({
  name: 'assess',
  description: 'ニュース・開示の判定（AI がスキルで付け、人が上書きできる）',
  commands: [
    {
      name: 'pending',
      description: '未判定のニュース・開示を JSON で出す。開示は PDF 本文つき',
      configure: (c) =>
        c
          .option('--limit <n>', '最大件数', '50')
          .option('--kind <kind>', SUBJECT_TYPES.join(' | ')),
      handler: (options: { limit: string; kind?: string }, context) => {
        const limit = Number(options.limit)
        if (!Number.isInteger(limit) || limit <= 0)
          throw new UsageError(`--limit は正の整数: ${options.limit}`)
        if (options.kind !== undefined && !SUBJECT_TYPES.includes(options.kind as SubjectType))
          throw new UsageError(`--kind は ${SUBJECT_TYPES.join(' | ')}`)
        const kind = options.kind as SubjectType | undefined
        return withDatabase(context, (handle) =>
          buildPending(handle, { limit, ...(kind ? { kind } : {}) }, (url) => fetchPdfText(url)),
        )
      },
    },
    {
      name: 'record',
      description: '判定を書き込む（--input に配列。不正な要素があれば全体を失敗にする）',
      handler: (_o, context) => {
        const inputs = parseRecordInput(context.readInput())
        if (context.options.dryRun) return { written: 0, valid: inputs.length, dryRun: true }
        return withDatabase(context, (handle) => {
          try {
            return recordAssessments(handle.db, inputs)
          } catch (e) {
            throw new ToolError('subject_not_found', e instanceof Error ? e.message : String(e))
          }
        })
      },
    },
    {
      name: 'override',
      description: '人が判定を上書きする（human の判定を追加。AI の判定は残る）',
      configure: (c) =>
        c
          .argument('<assessment-id>')
          .requiredOption('--sentiment <n>', '-2..2')
          .option('--impact <n>', '1..3')
          .option('--relevance <r>', 'relevant | irrelevant')
          .option('--direction <d>', DIRECTIONS.join(' | '))
          .option('--note <text>', 'メモ'),
      handler: (
        options: {
          sentiment: string
          impact?: string
          relevance?: string
          direction?: string
          note?: string
        },
        context,
        [idArg],
      ) => {
        const id = Number(idArg)
        if (!Number.isInteger(id) || id <= 0)
          throw new UsageError(`assessment-id は正の整数: ${idArg}`)
        return withDatabase(context, (handle) => {
          const base = getAssessment(handle.db, id)
          if (!base) throw new ToolError('not_found', `判定 ${id} はありません`)
          const raw = {
            kind: base.subjectType,
            id: base.subjectId,
            relevance: options.relevance ?? base.relevance,
            sentiment: Number(options.sentiment),
            impact: options.impact === undefined ? base.impact : Number(options.impact),
            ...(options.direction !== undefined
              ? { direction: options.direction as Direction }
              : base.direction
                ? { direction: base.direction as Direction }
                : {}),
            summary: base.summary,
            rationale: base.rationale,
            author: 'human',
            ...(options.note !== undefined ? { note: options.note } : {}),
          }
          const v = validateAssessmentInput(raw, 0)
          if (!v.ok) throw new UsageError(v.error)
          if (context.options.dryRun) return { ...v.value, dryRun: true }
          return recordAssessments(handle.db, [v.value])
        })
      },
    },
    {
      name: 'list',
      description: '有効な判定（human があればそれ、無ければ ai）',
      configure: (c) =>
        c
          .option('--instrument <id>', '銘柄 id（例 JP:7203）')
          .option('--since <date>', 'YYYY-MM-DD 以降に付けたもの'),
      handler: (options: { instrument?: string; since?: string }, context) =>
        withDatabase(context, (handle) =>
          effectiveAssessments(handle.db, {
            ...(options.instrument ? { instrumentId: options.instrument } : {}),
            ...(options.since ? { since: options.since } : {}),
          }),
        ),
    },
  ],
})
