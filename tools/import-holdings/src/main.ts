import { tool } from './tool.ts'

process.exitCode = await tool.run(process.argv.slice(2))
