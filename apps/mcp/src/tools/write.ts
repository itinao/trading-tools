import { addWatch, removeWatch, setActionStatus } from '@trading/domain'
import { z } from 'zod'
import { db } from '../lib/db.ts'
import { result } from '../lib/format.ts'
import type { McpTool } from './read.ts'

/**
 * 書き込みのツール（Design Doc 0018 §2）。既定では登録せず、--write のときだけ出す。
 * 検証は @trading/domain 側にある（保有中の銘柄はウォッチに足せない、など）。
 */

export const writeTools: McpTool[] = [
  {
    name: 'action_resolve',
    title: 'アクションを処理する',
    description:
      'アクションを 対応した / 見送り にする（open に戻すこともできる）。何をしたか（売った / 買った / 確認した）を note に書くと履歴と振り返りに残る。',
    inputSchema: {
      id: z.number().int().positive().describe('アクションの id'),
      status: z.enum(['done', 'dismissed', 'open']).describe('対応した / 見送り / 未対応に戻す'),
      note: z.string().max(500).optional().describe('何をしたか'),
    },
    handler: (args) => {
      const r = setActionStatus(
        db(),
        Number(args.id),
        args.status as 'done' | 'dismissed' | 'open',
        args.note as string | undefined,
      )
      if (!r) throw new Error(`アクション ${args.id} はありません`)
      return result(r)
    },
  },
  {
    name: 'watch_add',
    title: 'ウォッチに追加する',
    description: '銘柄をウォッチに追加する。翌日から収集と検知の対象になる。',
    inputSchema: {
      code: z.string().describe('証券コード（4 桁）'),
      note: z.string().max(200).optional().describe('追加した理由'),
    },
    handler: (args) =>
      result(
        addWatch(db(), String(args.code).trim().toUpperCase(), {
          source: 'mcp',
          ...(args.note ? { note: String(args.note) } : {}),
        }),
      ),
  },
  {
    name: 'watch_remove',
    title: 'ウォッチから外す',
    description: 'ウォッチから外す。銘柄と集めた事実は残る。未対応のアクションは見送りになる。',
    inputSchema: { code: z.string().describe('証券コード（4 桁）') },
    handler: (args) => result(removeWatch(db(), String(args.code).trim().toUpperCase())),
  },
]
