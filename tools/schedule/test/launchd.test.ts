import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { dailyScript, install, type Launchctl, plist, status, uninstall } from '../src/launchd.ts'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'schedule-'))
  dirs.push(d)
  return d
}
function fakeLaunchctl() {
  const calls: string[] = []
  let loaded = false
  const l: Launchctl = {
    bootstrap: (p) => {
      calls.push(`bootstrap ${p}`)
      loaded = true
    },
    bootout: () => {
      calls.push('bootout')
      loaded = false
    },
    isLoaded: () => loaded,
  }
  return { l, calls }
}

describe('launchd', () => {
  it('plist は平日・時刻・作業ディレクトリ・PATH・TZ を含む', () => {
    const xml = plist(
      { root: '/repo', pnpmPath: '/usr/local/bin/pnpm', hour: 18, minute: 30 },
      '/repo/data/daily.sh',
    )
    expect(xml).toContain('<key>Label</key><string>com.trading-tools.daily</string>')
    expect((xml.match(/<key>Weekday<\/key>/g) ?? []).length).toBe(5)
    expect(xml).toContain('<key>Hour</key><integer>18</integer>')
    expect(xml).toContain('<key>WorkingDirectory</key><string>/repo</string>')
    expect(xml).toContain('<key>TZ</key><string>Asia/Tokyo</string>')
  })
  it('スクリプトは collect all と detect run を順に実行し、失敗しても続ける', () => {
    const s = dailyScript({ root: '/repo', pnpmPath: '/p/pnpm' })
    expect(s).toContain('"/p/pnpm" --silent collect --quiet all')
    expect(s).toContain('"/p/pnpm" --silent detect --quiet run')
    expect(s).toContain('|| status=$?')
  })
  it('install → status → uninstall', () => {
    const home = tmp()
    const root = tmp()
    const { l, calls } = fakeLaunchctl()
    const r = install({ root, pnpmPath: '/p/pnpm', hour: 7, minute: 5 }, { home, launchctl: l })
    expect(existsSync(r.plist)).toBe(true)
    expect(existsSync(r.script)).toBe(true)
    expect(readFileSync(r.script, 'utf8')).toContain(`cd "${root}"`)
    expect(calls).toEqual(['bootout', `bootstrap ${r.plist}`])
    expect(status({ home, launchctl: l })).toMatchObject({
      installed: true,
      loaded: true,
      schedule: 'weekdays 1,2,3,4,5 at 7:05 JST',
    })
    expect(uninstall({ home, launchctl: l })).toEqual({ removed: true })
    expect(status({ home, launchctl: l })).toMatchObject({ installed: false, loaded: false })
    expect(uninstall({ home, launchctl: l })).toEqual({ removed: false })
  })
})
