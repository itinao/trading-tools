import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { readTools } from './tools/read.ts'
import { writeTools } from './tools/write.ts'

/** MCP サーバーを組み立てる（Design Doc 0018）。既定は読み取り専用、write: true で書き込みも出す */
export function createServer(options: { write?: boolean } = {}): McpServer {
  const server = new McpServer(
    { name: 'trading-tools', version: '0.1.0' },
    {
      instructions:
        '日本株の資産運用ツールのデータ。事実（株価・ニュース・開示・財務）と評価（スコア・シグナル・アクション・AI の助言）を読む。' +
        '投資判断は人が行う。数値は JPY、日付は Asia/Tokyo。',
    },
  )
  const tools = options.write ? [...readTools, ...writeTools] : readTools
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: !writeTools.includes(tool) },
      },
      (args: Record<string, unknown>) => tool.handler(args ?? {}),
    )
  }
  return server
}
