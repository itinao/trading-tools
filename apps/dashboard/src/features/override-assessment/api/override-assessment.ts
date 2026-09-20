import { createServerFn } from '@tanstack/react-start'

/** 人が判定を上書きする。CLI の `assess override` と同じ recordAssessments を使う（author = human） */
export const overrideAssessment = createServerFn({ method: 'POST' })
  .validator((input: { assessmentId: number; sentiment: number; note?: string }) => {
    if (
      !Number.isInteger(input.assessmentId) ||
      !Number.isInteger(input.sentiment) ||
      input.sentiment < -2 ||
      input.sentiment > 2
    )
      throw new Error('bad input')
    return input
  })
  .handler(async ({ data }) => {
    const { db } = await import('../../../shared/api')
    const { getAssessment, recordAssessments, validateAssessmentInput } = await import(
      '@trading/domain'
    )
    const base = getAssessment(db(), data.assessmentId)
    if (!base) return null
    const v = validateAssessmentInput(
      {
        kind: base.subjectType,
        id: base.subjectId,
        relevance: base.relevance,
        sentiment: data.sentiment,
        impact: base.impact,
        ...(base.direction ? { direction: base.direction } : {}),
        summary: base.summary,
        rationale: base.rationale,
        author: 'human',
        ...(data.note ? { note: data.note } : {}),
      },
      0,
    )
    if (!v.ok) throw new Error(v.error)
    return recordAssessments(db(), [v.value])
  })
