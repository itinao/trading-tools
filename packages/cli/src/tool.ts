import { readFileSync } from 'node:fs'
import { Command, CommanderError } from 'commander'
import { ToolError, UsageError } from './errors.ts'
import { Logger, levelFromOptions } from './logger.ts'
import { resolveDbPath } from './workspace.ts'

/** すべてのツールが受け付ける共通オプション（Design Doc 0002 §3.3） */
export interface CommonOptions {
  db?: string
  dryRun: boolean
  quiet: boolean
  verbose: boolean
  input?: string
}

export interface ToolContext {
  options: CommonOptions
  logger: Logger
  /** 解決済みの DB パス（絶対パス、または ':memory:'） */
  dbPath: string
  /** --input で渡された JSON を読む。'-' は stdin */
  readInput<T = unknown>(): T
}

export interface CommandDefinition<
  TOptions extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string
  description: string
  /** サブコマンド固有の引数・オプションを追加する */
  configure?: (command: Command) => void
  handler: (options: TOptions, context: ToolContext, args: string[]) => Promise<unknown> | unknown
}

export interface ToolDefinition {
  name: string
  description: string
  version?: string
  // biome-ignore lint/suspicious/noExplicitAny: サブコマンドごとにオプションの型が異なる
  commands: CommandDefinition<any>[]
}

export interface ToolIo {
  stdout: (text: string) => void
  stderr: (text: string) => void
  stdin: () => string
  env: NodeJS.ProcessEnv
}

export interface ToolResultOk {
  ok: true
  data: unknown
}
export interface ToolResultError {
  ok: false
  error: { code: string; message: string; details?: unknown }
}
export type ToolResult = ToolResultOk | ToolResultError

const defaultIo: ToolIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  stdin: () => readFileSync(0, 'utf8'),
  env: process.env,
}

/**
 * CLI 規約に沿ったツールを定義する。
 * - stdout には JSON を1つだけ書く（ok/data または ok/error）
 * - 終了コードは 0 成功、1 実行時の失敗、2 引数の誤り
 * - ログとヘルプは stderr
 */
export function defineTool(definition: ToolDefinition) {
  async function run(argv: string[], io: Partial<ToolIo> = {}): Promise<number> {
    const { stdout, stderr, stdin, env } = { ...defaultIo, ...io }
    let result: unknown
    let handled = false

    const program = new Command(definition.name)
      .description(definition.description)
      .exitOverride()
      .configureOutput({ writeOut: stderr, writeErr: stderr })
      .option('--db <path>', 'SQLite ファイルの場所（TRADING_DB_PATH より優先）')
      .option('--dry-run', '書き込みを行わず、行う予定を返す', false)
      .option('--quiet', 'エラー以外のログを出さない', false)
      .option('--verbose', 'デバッグログを出す', false)
      .option('--input <path>', 'JSON 入力ファイル。- で stdin')
    if (definition.version) program.version(definition.version, '-V, --version')

    for (const def of definition.commands) {
      const command = program.command(def.name).description(def.description)
      def.configure?.(command)
      command.action(async (...actionArgs: unknown[]) => {
        // commander は (…positional, options, command) の順で渡す
        const cmd = actionArgs.at(-1) as Command
        const options = actionArgs.at(-2) as Record<string, unknown>
        const positional = actionArgs.slice(0, -2) as string[]
        const common = program.opts<CommonOptions>()
        const logger = new Logger(stderr, levelFromOptions(common))
        const context: ToolContext = {
          options: common,
          logger,
          dbPath: resolveDbPath(common.db, env),
          readInput: <T>() => readJsonInput<T>(common.input, stdin),
        }
        logger.debug(`${definition.name} ${cmd.name()} db=${context.dbPath}`)
        result = await def.handler(options, context, positional)
        handled = true
      })
    }

    try {
      await program.parseAsync(argv, { from: 'user' })
      if (!handled) {
        // サブコマンドなしで呼ばれた（help は CommanderError で抜ける）
        throw new UsageError('サブコマンドを指定してください')
      }
      return emit(stdout, { ok: true, data: result ?? null }, 0)
    } catch (error) {
      return emit(stdout, ...toFailure(error))
    }
  }

  return { run, definition }
}

function readJsonInput<T>(path: string | undefined, stdin: () => string): T {
  if (!path) throw new UsageError('--input が必要です')
  const text = path === '-' ? stdin() : readFileSync(path, 'utf8')
  try {
    return JSON.parse(text) as T
  } catch (cause) {
    throw new UsageError(`--input の JSON を解釈できません: ${path}`, String(cause))
  }
}

function emit(stdout: (text: string) => void, result: ToolResult, exitCode: number): number {
  stdout(`${JSON.stringify(result)}\n`)
  return exitCode
}

function toFailure(error: unknown): [ToolResultError, number] {
  if (error instanceof CommanderError) {
    // --help / --version は正常終了扱い。出力は既に stderr に出ている
    if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
      return [{ ok: false, error: { code: 'help', message: error.message } }, 0]
    }
    return [{ ok: false, error: { code: 'usage', message: error.message.trim() } }, 2]
  }
  if (error instanceof ToolError) {
    const payload: ToolResultError = {
      ok: false,
      error: { code: error.code, message: error.message },
    }
    if (error.details !== undefined) payload.error.details = error.details
    return [payload, error.exitCode]
  }
  const message = error instanceof Error ? error.message : String(error)
  return [{ ok: false, error: { code: 'internal', message } }, 1]
}
