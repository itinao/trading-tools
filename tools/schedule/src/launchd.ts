import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * macOS の launchd で日次実行を登録する（Design Doc 0011 §3.6）。
 * 平日 18:30 JST に `collect all` → `detect run` を実行し、data/logs/ にログを残す。
 */

export const LABEL = 'com.trading-tools.daily'

export interface ScheduleOptions {
  root: string
  pnpmPath: string
  hour?: number
  minute?: number
  /** 曜日 1..7（1 = 月）。既定は平日 */
  weekdays?: number[]
}

export function plistPath(home: string = homedir()): string {
  return join(home, 'Library', 'LaunchAgents', `${LABEL}.plist`)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 日次のシェルスクリプト。1 つが失敗しても次を実行し、終了コードは最後の失敗を返す */
export function dailyScript(opts: ScheduleOptions): string {
  return `#!/bin/sh
# trading-tools の日次実行（launchd から呼ばれる）。生成物なので手で編集しない: pnpm schedule install
cd "${opts.root}" || exit 1
mkdir -p data/logs
log="data/logs/daily-$(date +%Y-%m-%d).log"
status=0
echo "=== $(date '+%Y-%m-%dT%H:%M:%S%z') collect all" >> "$log"
"${opts.pnpmPath}" --silent collect --quiet all >> "$log" 2>&1 || status=$?
echo "=== $(date '+%Y-%m-%dT%H:%M:%S%z') detect run" >> "$log"
"${opts.pnpmPath}" --silent detect --quiet run >> "$log" 2>&1 || status=$?
echo "=== $(date '+%Y-%m-%dT%H:%M:%S%z') done status=$status" >> "$log"
exit $status
`
}

export function plist(opts: ScheduleOptions, scriptPath: string): string {
  const hour = opts.hour ?? 18
  const minute = opts.minute ?? 30
  const weekdays = opts.weekdays ?? [1, 2, 3, 4, 5]
  const entries = weekdays
    .map(
      (w) => `    <dict>
      <key>Weekday</key><integer>${w}</integer>
      <key>Hour</key><integer>${hour}</integer>
      <key>Minute</key><integer>${minute}</integer>
    </dict>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>${esc(scriptPath)}</string>
  </array>
  <key>WorkingDirectory</key><string>${esc(opts.root)}</string>
  <key>StartCalendarInterval</key>
  <array>
${entries}
  </array>
  <key>StandardOutPath</key><string>${esc(join(opts.root, 'data', 'logs', 'launchd.out.log'))}</string>
  <key>StandardErrorPath</key><string>${esc(join(opts.root, 'data', 'logs', 'launchd.err.log'))}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>TZ</key><string>Asia/Tokyo</string>
  </dict>
</dict>
</plist>
`
}

export interface Launchctl {
  bootstrap(path: string): void
  bootout(): void
  isLoaded(): boolean
}

export function realLaunchctl(uid: number = process.getuid?.() ?? 501): Launchctl {
  const domain = `gui/${uid}`
  return {
    bootstrap: (path) => {
      execFileSync('launchctl', ['bootstrap', domain, path], { stdio: 'pipe' })
    },
    bootout: () => {
      try {
        execFileSync('launchctl', ['bootout', `${domain}/${LABEL}`], { stdio: 'pipe' })
      } catch {
        // 未登録なら無視
      }
    },
    isLoaded: () => {
      try {
        execFileSync('launchctl', ['print', `${domain}/${LABEL}`], { stdio: 'pipe' })
        return true
      } catch {
        return false
      }
    },
  }
}

export function install(
  opts: ScheduleOptions,
  io: { home: string; launchctl: Launchctl },
): { plist: string; script: string } {
  const scriptPath = join(opts.root, 'data', 'daily.sh')
  mkdirSync(join(opts.root, 'data', 'logs'), { recursive: true })
  writeFileSync(scriptPath, dailyScript(opts), { mode: 0o755 })
  const path = plistPath(io.home)
  mkdirSync(join(io.home, 'Library', 'LaunchAgents'), { recursive: true })
  io.launchctl.bootout()
  writeFileSync(path, plist(opts, scriptPath))
  io.launchctl.bootstrap(path)
  return { plist: path, script: scriptPath }
}

export function uninstall(io: { home: string; launchctl: Launchctl }): { removed: boolean } {
  io.launchctl.bootout()
  const path = plistPath(io.home)
  const existed = existsSync(path)
  if (existed) rmSync(path)
  return { removed: existed }
}

export function status(io: { home: string; launchctl: Launchctl }): {
  installed: boolean
  loaded: boolean
  plist: string
  schedule?: string
} {
  const path = plistPath(io.home)
  const installed = existsSync(path)
  const out: { installed: boolean; loaded: boolean; plist: string; schedule?: string } = {
    installed,
    loaded: installed && io.launchctl.isLoaded(),
    plist: path,
  }
  if (installed) {
    const xml = readFileSync(path, 'utf8')
    const hour = /<key>Hour<\/key><integer>(\d+)<\/integer>/.exec(xml)?.[1]
    const minute = /<key>Minute<\/key><integer>(\d+)<\/integer>/.exec(xml)?.[1]
    const days = [...xml.matchAll(/<key>Weekday<\/key><integer>(\d)<\/integer>/g)]
      .map((m) => m[1])
      .join(',')
    if (hour !== undefined)
      out.schedule = `weekdays ${days} at ${hour}:${String(minute ?? 0).padStart(2, '0')} JST`
  }
  return out
}
