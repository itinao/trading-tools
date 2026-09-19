import { describe, expect, it } from 'vitest'
import { defineTool, ToolError, UsageError } from '../src/index.ts'

function harness() {
  const out: string[] = []
  const err: string[] = []
  return {
    io: {
      stdout: (t: string) => {
        out.push(t)
      },
      stderr: (t: string) => {
        err.push(t)
      },
      stdin: () => '{"from":"stdin"}',
      env: {} as NodeJS.ProcessEnv,
    },
    json: () => JSON.parse(out.join('')),
    stdoutLines: () => out.join('').trim().split('\n'),
    stderr: () => err.join(''),
  }
}

const tool = defineTool({
  name: 'sample',
  description: 'テスト用',
  version: '0.0.0',
  commands: [
    {
      name: 'echo',
      description: '引数を返す',
      configure: (c) => c.argument('<word>').option('--upper', '大文字にする', false),
      handler: (opts: { upper: boolean }, ctx, [word]) => {
        ctx.logger.info('echoing')
        return { word: opts.upper ? word?.toUpperCase() : word, dryRun: ctx.options.dryRun }
      },
    },
    {
      name: 'input',
      description: '--input を返す',
      handler: (_o, ctx) => ctx.readInput(),
    },
    {
      name: 'fail',
      description: 'ToolError を投げる',
      handler: () => {
        throw new ToolError('sample_failed', 'だめでした', { details: { n: 1 } })
      },
    },
    {
      name: 'usage',
      description: 'UsageError を投げる',
      handler: () => {
        throw new UsageError('引数が足りません')
      },
    },
    {
      name: 'crash',
      description: '想定外の例外',
      handler: () => {
        throw new Error('boom')
      },
    },
    {
      name: 'dbpath',
      description: 'DB パスを返す',
      handler: (_o, ctx) => ({ dbPath: ctx.dbPath }),
    },
  ],
})

describe('defineTool', () => {
  it('成功時は ok/data の JSON を stdout に1行だけ書き、終了コード 0', async () => {
    const h = harness()
    const code = await tool.run(['echo', 'hi', '--upper'], h.io)
    expect(code).toBe(0)
    expect(h.stdoutLines()).toHaveLength(1)
    expect(h.json()).toEqual({ ok: true, data: { word: 'HI', dryRun: false } })
  })

  it('ログは stderr に出て、--quiet で消える', async () => {
    const h = harness()
    await tool.run(['echo', 'hi'], h.io)
    expect(h.stderr()).toContain('[info] echoing')

    const q = harness()
    await tool.run(['--quiet', 'echo', 'hi'], q.io)
    expect(q.stderr()).toBe('')
  })

  it('--dry-run は共通オプションとして context に入る', async () => {
    const h = harness()
    await tool.run(['--dry-run', 'echo', 'x'], h.io)
    expect(h.json().data.dryRun).toBe(true)
  })

  it('ToolError は ok:false と code/message/details、終了コード 1', async () => {
    const h = harness()
    const code = await tool.run(['fail'], h.io)
    expect(code).toBe(1)
    expect(h.json()).toEqual({
      ok: false,
      error: { code: 'sample_failed', message: 'だめでした', details: { n: 1 } },
    })
  })

  it('UsageError は終了コード 2', async () => {
    const h = harness()
    expect(await tool.run(['usage'], h.io)).toBe(2)
    expect(h.json().error.code).toBe('usage')
  })

  it('commander の引数エラーも終了コード 2 で JSON になる', async () => {
    const h = harness()
    expect(await tool.run(['echo'], h.io)).toBe(2)
    expect(h.json().ok).toBe(false)
    expect(h.json().error.code).toBe('usage')
    expect(h.stdoutLines()).toHaveLength(1)
  })

  it('未知のサブコマンドは終了コード 2', async () => {
    const h = harness()
    expect(await tool.run(['nope'], h.io)).toBe(2)
  })

  it('サブコマンドなしは終了コード 2', async () => {
    const h = harness()
    expect(await tool.run([], h.io)).toBe(2)
  })

  it('想定外の例外は code:internal、終了コード 1', async () => {
    const h = harness()
    expect(await tool.run(['crash'], h.io)).toBe(1)
    expect(h.json().error).toEqual({ code: 'internal', message: 'boom' })
  })

  it('--help は stderr に出て、終了コード 0', async () => {
    const h = harness()
    expect(await tool.run(['--help'], h.io)).toBe(0)
    expect(h.stderr()).toContain('Usage:')
    expect(h.json().error.code).toBe('help')
  })

  it('--input - は stdin から JSON を読む', async () => {
    const h = harness()
    await tool.run(['--input', '-', 'input'], h.io)
    expect(h.json()).toEqual({ ok: true, data: { from: 'stdin' } })
  })

  it('--input なしで readInput すると usage エラー', async () => {
    const h = harness()
    expect(await tool.run(['input'], h.io)).toBe(2)
  })

  it('DB パスは --db > TRADING_DB_PATH > 既定 の順で、リポジトリルート基準の絶対パス', async () => {
    const a = harness()
    await tool.run(['dbpath'], a.io)
    expect(a.json().data.dbPath).toMatch(/\/data\/trading\.db$/)

    const b = harness()
    b.io.env = { TRADING_DB_PATH: 'tmp/env.db' } as NodeJS.ProcessEnv
    await tool.run(['dbpath'], b.io)
    expect(b.json().data.dbPath).toMatch(/\/tmp\/env\.db$/)

    const c = harness()
    c.io.env = { TRADING_DB_PATH: 'tmp/env.db' } as NodeJS.ProcessEnv
    await tool.run(['--db', ':memory:', 'dbpath'], c.io)
    expect(c.json().data.dbPath).toBe(':memory:')
  })
})
