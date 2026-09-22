import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { closeMcpDatabase, openMcpDatabase } from './lib/db.ts'
import { createServer } from './server.ts'

/**
 * MCP サーバー（stdio）。stdout はプロトコルが使うので、ログは stderr に出す。
 * pnpm mcp [--write] [--db <path>]
 */

const argv = process.argv.slice(2)
const write = argv.includes('--write')
const dbIndex = argv.indexOf('--db')
const dbPath = dbIndex >= 0 ? argv[dbIndex + 1] : undefined

openMcpDatabase(dbPath)
const server = createServer({ write })
await server.connect(new StdioServerTransport())
console.error(`trading-tools mcp: ready (${write ? 'read-write' : 'read-only'})`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    closeMcpDatabase()
    process.exit(0)
  })
}
