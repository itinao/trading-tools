import { todayJst } from '@trading/cli'
import { schema } from '@trading/db'
import {
  adviceForActions,
  dashboardStatus,
  effectiveAssessments,
  financialHistory,
  getScreenRun,
  history,
  latestFundamentals,
  latestQuotes,
  latestScores,
  latestSnapshot,
  listActions,
  listScreenRuns,
  listWatches,
  monitoredInstruments,
  pendingAdvice,
  pendingSubjects,
  positions,
  quoteHistory,
  recentDisclosures,
  recentNews,
  timeline,
} from '@trading/domain'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../lib/db.ts'
import { instrumentIdOf, result } from '../lib/format.ts'

/**
 * 読み取りのツール（Design Doc 0018 §2）。画面と同じ「まとめて返す」単位にして、
 * 1 回の呼び出しで判断に足りる情報が返るようにする。
 */

export interface McpTool {
  name: string
  title: string
  description: string
  inputSchema: z.ZodRawShape
  handler: (args: Record<string, unknown>) => ReturnType<typeof result>
}

const pct = (a: number | null | undefined, b: number | null | undefined) =>
  a != null && b != null && b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : null

export const readTools: McpTool[] = [
  {
    name: 'actions_today',
    title: '今日のアクション',
    description:
      '未対応のアクション（検知したこと）と、それぞれへの AI の助言、株価の鮮度や未判定の件数。毎朝の確認の入口。',
    inputSchema: {
      status: z
        .enum(['open', 'done', 'dismissed'])
        .default('open')
        .describe('未対応 / 対応した / 見送り'),
    },
    handler: (args) => {
      const d = db()
      const status = (args.status as 'open' | 'done' | 'dismissed') ?? 'open'
      const actions = listActions(d, { status })
      const advice = adviceForActions(d, actions)
      const contexts = new Map(
        monitoredInstruments(d).map((m) => [m.instrumentId, m.position ? 'holding' : 'watch']),
      )
      const scores = latestScores(d)
      const st = dashboardStatus(d)
      return result({
        today: todayJst(),
        status: {
          latestQuoteDate: st.latestQuoteDate,
          openActions: st.openActions,
          pendingAssessments: st.pendingAssessments,
          monitored: st.monitored,
        },
        actions: actions.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          context: contexts.get(a.instrumentId) ?? null,
          kind: a.kind,
          severity: a.severity,
          value: a.value,
          title: a.title,
          body: a.body,
          note: a.note,
          createdAt: a.createdAt,
          score: scores.get(a.instrumentId)?.score ?? null,
          advice: advice.get(a.id) ?? null,
        })),
      })
    },
  },
  {
    name: 'instruments_list',
    title: '監視している銘柄',
    description: '保有とウォッチの一覧。最新の株価・前日比・スコア、保有なら取得単価と評価損益。',
    inputSchema: {
      context: z
        .enum(['all', 'holding', 'watch'])
        .default('all')
        .describe('保有 / ウォッチ で絞る'),
    },
    handler: (args) => {
      const d = db()
      const want = (args.context as 'all' | 'holding' | 'watch') ?? 'all'
      const quotes = latestQuotes(d)
      const scores = latestScores(d)
      const previous = (id: string, asOf: string) =>
        quoteHistory(d, id, { upTo: asOf, limit: 2 })[1]?.price ?? null
      const holdings =
        want === 'watch'
          ? []
          : positions(d).map((p) => {
              const q = quotes.get(p.instrumentId)
              const price = q?.price ?? null
              return {
                context: 'holding' as const,
                code: p.code,
                name: p.name,
                quantity: p.quantity,
                averageCost: Math.round(p.averageCost * 100) / 100,
                price,
                priceAsOf: q?.asOf ?? null,
                dayChangePct: q ? pct(price, previous(p.instrumentId, q.asOf)) : null,
                costChangePct: pct(price, p.averageCost),
                marketValue: price == null ? null : Math.round(price * p.quantity),
                unrealizedPnl:
                  price == null ? null : Math.round((price - p.averageCost) * p.quantity),
                score: scores.get(p.instrumentId)?.score ?? null,
              }
            })
      const watches =
        want === 'holding'
          ? []
          : listWatches(d).map((w) => {
              const q = quotes.get(w.instrumentId)
              return {
                context: 'watch' as const,
                code: w.code,
                name: w.name,
                price: q?.price ?? null,
                priceAsOf: q?.asOf ?? null,
                dayChangePct: q ? pct(q.price, previous(w.instrumentId, q.asOf)) : null,
                score: scores.get(w.instrumentId)?.score ?? null,
              }
            })
      const snapshot = latestSnapshot(d)
      return result({
        today: todayJst(),
        snapshotAsOf: snapshot?.asOf ?? null,
        holdings,
        watches,
      })
    },
  },
  {
    name: 'instrument_overview',
    title: '銘柄の概要',
    description:
      '1 銘柄の「今どうか」: 株価とスコア、保有の状況、未対応のアクションと助言、最近のニュース・開示（判定つき）、指標と年次の財務、直近の出来事。',
    inputSchema: {
      code: z.string().describe('証券コード（4 桁。例 7203）'),
      days: z.number().int().positive().default(90).describe('タイムラインの日数'),
    },
    handler: (args) => {
      const d = db()
      const id = instrumentIdOf(String(args.code))
      const instrument = d
        .select()
        .from(schema.instruments)
        .where(eq(schema.instruments.id, id))
        .get()
      if (!instrument) throw new Error(`${args.code} は登録されていません`)
      const monitored = monitoredInstruments(d).find((m) => m.instrumentId === id) ?? null
      const quotes = quoteHistory(d, id, { limit: 30 })
      const actions = listActions(d, { instrumentId: id }).filter((a) => a.status === 'open')
      const advice = adviceForActions(d, actions)
      const assessments = new Map(
        effectiveAssessments(d, { instrumentId: id }).map((a) => [
          `${a.subjectType}:${a.subjectId}`,
          { sentiment: a.sentiment, impact: a.impact, direction: a.direction, summary: a.summary },
        ]),
      )
      const f = latestFundamentals(d, id)
      return result({
        code: instrument.code,
        name: instrument.name,
        context: monitored ? (monitored.position ? 'holding' : 'watch') : null,
        position: monitored?.position ?? null,
        price: quotes[0]?.price ?? null,
        priceAsOf: quotes[0]?.asOf ?? null,
        dayChangePct: pct(quotes[0]?.price ?? null, quotes[1]?.price ?? null),
        score: latestScores(d).get(id) ?? null,
        actions: actions.map((a) => ({
          id: a.id,
          kind: a.kind,
          severity: a.severity,
          value: a.value,
          title: a.title,
          body: a.body,
          createdAt: a.createdAt,
          advice: advice.get(a.id) ?? null,
        })),
        news: recentNews(d, id, 10).map((n) => ({
          publishedAt: n.publishedAt,
          title: n.title,
          publisher: n.publisher,
          url: n.url,
          assessment: assessments.get(`news:${n.id}`) ?? null,
        })),
        disclosures: recentDisclosures(d, id, 10).map((x) => ({
          disclosedAt: x.disclosedAt,
          category: x.category,
          title: x.title,
          pdfUrl: x.pdfUrl,
          assessment: assessments.get(`disclosure:${x.id}`) ?? null,
        })),
        fundamentals: f ?? null,
        financials: financialHistory(d, id, 'annual'),
        quotes: quotes.map((q) => ({ asOf: q.asOf, price: q.price })),
        timeline: timeline(d, id, { days: Number(args.days ?? 90) }).events,
      })
    },
  },
  {
    name: 'review_history',
    title: '判断の履歴',
    description:
      '対応した / 見送り にしたアクションと、判断した日の株価とその後の変化。助言 × 判断の集計つき。振り返りに使う。',
    inputSchema: {
      since: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('この日以降（YYYY-MM-DD）'),
    },
    handler: (args) => {
      const since = args.since as string | undefined
      return result(history(db(), since ? { since } : {}))
    },
  },
  {
    name: 'screen_result',
    title: 'スクリーニングの結果',
    description:
      'pnpm screen run の実行結果。id を省略すると実行の一覧を返す。候補の銘柄と指標が返る。',
    inputSchema: {
      id: z.number().int().positive().optional().describe('実行の id。省略時は一覧'),
    },
    handler: (args) => {
      const d = db()
      if (args.id == null) return result({ runs: listScreenRuns(d, 20) })
      const run = getScreenRun(d, Number(args.id))
      if (!run) throw new Error(`実行 ${args.id} はありません`)
      return result(run)
    },
  },
  {
    name: 'assess_pending',
    title: '未判定のニュース・開示',
    description:
      'AI の判定がまだ無いニュースと適時開示。判定は pnpm assess record で書き戻す（このサーバーからは書けない）。',
    inputSchema: {
      limit: z.number().int().positive().max(100).default(20).describe('件数'),
    },
    handler: (args) => result(pendingSubjects(db(), { limit: Number(args.limit ?? 20) })),
  },
  {
    name: 'advise_pending',
    title: '助言待ちのアクション',
    description:
      '助言がまだ無い未対応のアクションと、判断に必要な事実の束（株価の推移、判定済みのニュース、財務、保有の状況）。',
    inputSchema: {
      limit: z.number().int().positive().max(50).default(20).describe('件数'),
    },
    handler: (args) => result(pendingAdvice(db(), Number(args.limit ?? 20))),
  },
]
