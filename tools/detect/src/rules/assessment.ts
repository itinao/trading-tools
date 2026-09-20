import type { Assessment } from '@trading/domain'
import type { DetectConfig } from '../config.ts'
import type { RuleOutcome } from './types.ts'

/** 判定に対象の日時（ニュースの公開日時 / 開示の日時）を付けたもの */
export interface DatedAssessment extends Assessment {
  subjectAt: string
  subjectTitle: string
  subjectCategory?: string
}

/** 日付単位の経過日数（当日 = 0） */
const daysBetween = (asOf: string, subjectAt: string) =>
  (Date.parse(asOf) - Date.parse(subjectAt.slice(0, 10))) / 86_400_000

function within(a: DatedAssessment, asOf: string, windowDays: number): boolean {
  const d = daysBetween(asOf, a.subjectAt)
  return d >= 0 && d <= windowDays
}

/** 直近 windowDays 日に、関係あり・かつ悪材料で影響の大きい判定があるか。最も悪いものを代表にする */
export function newsNegative(
  assessments: DatedAssessment[],
  asOf: string,
  cfg: DetectConfig['news_negative'],
): RuleOutcome {
  const hits = assessments.filter(
    (a) =>
      a.subjectType === 'news' &&
      a.relevance === 'relevant' &&
      a.sentiment <= cfg.maxSentiment &&
      a.impact >= cfg.minImpact &&
      within(a, asOf, cfg.windowDays),
  )
  if (hits.length === 0) return null
  const worst = hits.sort(
    (x, y) => x.sentiment * x.impact - y.sentiment * y.impact,
  )[0] as DatedAssessment
  return {
    kind: 'news_negative',
    severity: worst.impact >= 3 ? 'critical' : 'warn',
    value: worst.sentiment * worst.impact,
    details: {
      subjectType: 'news',
      subjectId: worst.subjectId,
      title: worst.subjectTitle,
      summary: worst.summary,
      rationale: worst.rationale,
      count: hits.length,
      assessmentId: worst.id,
    },
  }
}

function disclosureDown(
  assessments: DatedAssessment[],
  asOf: string,
  category: string,
  kind: 'forecast_down' | 'dividend_cut',
  windowDays: number,
): RuleOutcome {
  const hits = assessments.filter(
    (a) =>
      a.subjectType === 'disclosure' &&
      a.subjectCategory === category &&
      a.direction === 'down' &&
      within(a, asOf, windowDays),
  )
  if (hits.length === 0) return null
  const latest = hits.sort((x, y) => y.subjectAt.localeCompare(x.subjectAt))[0] as DatedAssessment
  return {
    kind,
    severity: 'critical',
    value: latest.sentiment * latest.impact,
    details: {
      subjectType: 'disclosure',
      subjectId: latest.subjectId,
      title: latest.subjectTitle,
      summary: latest.summary,
      rationale: latest.rationale,
      disclosedAt: latest.subjectAt,
      assessmentId: latest.id,
    },
  }
}

/** 業績予想の下方修正（開示に direction = down の判定） */
export function forecastDown(
  assessments: DatedAssessment[],
  asOf: string,
  cfg: DetectConfig['forecast_down'],
): RuleOutcome {
  return disclosureDown(assessments, asOf, 'forecast_revision', 'forecast_down', cfg.windowDays)
}

/** 減配・無配（配当の開示に direction = down の判定） */
export function dividendCut(
  assessments: DatedAssessment[],
  asOf: string,
  cfg: DetectConfig['dividend_cut'],
): RuleOutcome {
  return disclosureDown(assessments, asOf, 'dividend', 'dividend_cut', cfg.windowDays)
}
