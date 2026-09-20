import { execFileSync } from 'node:child_process'
import { homedir, platform } from 'node:os'
import { defineTool, findWorkspaceRoot, ToolError, UsageError } from '@trading/cli'
import { install, realLaunchctl, status, uninstall } from './launchd.ts'

function requireMac(): void {
  if (platform() !== 'darwin') throw new ToolError('unsupported', 'launchd は macOS でのみ使えます')
}

function pnpmPath(): string {
  try {
    return execFileSync('sh', ['-lc', 'command -v pnpm'], { encoding: 'utf8' }).trim()
  } catch {
    throw new ToolError('pnpm_not_found', 'pnpm が見つかりません')
  }
}

const io = () => ({ home: homedir(), launchctl: realLaunchctl() })

export const tool = defineTool({
  name: 'schedule',
  description: '日次実行（collect all → detect run）を macOS の launchd に登録する',
  commands: [
    {
      name: 'install',
      description: '登録する（既にあれば入れ直す）。既定は平日 18:30 JST',
      configure: (c) => c.option('--at <HH:MM>', '実行時刻', '18:30'),
      handler: (options: { at: string }, context) => {
        requireMac()
        const m = /^(\d{1,2}):(\d{2})$/.exec(options.at)
        if (!m) throw new UsageError(`--at は HH:MM: ${options.at}`)
        const opts = {
          root: findWorkspaceRoot(),
          pnpmPath: pnpmPath(),
          hour: Number(m[1]),
          minute: Number(m[2]),
        }
        if (context.options.dryRun) return { ...opts, dryRun: true }
        const r = install(opts, io())
        context.logger.info(`installed ${r.plist}`)
        return { ...r, schedule: `weekdays at ${options.at} JST` }
      },
    },
    {
      name: 'uninstall',
      description: '登録を外す',
      handler: (_o, context) => {
        requireMac()
        if (context.options.dryRun) return { dryRun: true }
        return uninstall(io())
      },
    },
    {
      name: 'status',
      description: '登録状態',
      handler: () => {
        requireMac()
        return status(io())
      },
    },
  ],
})
