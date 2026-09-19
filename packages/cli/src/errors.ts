/**
 * ツールが投げる失敗。`code` は機械可読、`message` は人向け。
 * 終了コードは 1（実行時の失敗）。引数の誤りは UsageError（2）を使う。
 */
export class ToolError extends Error {
  readonly code: string
  readonly exitCode: number
  readonly details: unknown

  constructor(
    code: string,
    message: string,
    options: { exitCode?: number; details?: unknown } = {},
  ) {
    super(message)
    this.name = 'ToolError'
    this.code = code
    this.exitCode = options.exitCode ?? 1
    this.details = options.details
  }
}

export class UsageError extends ToolError {
  constructor(message: string, details?: unknown) {
    super('usage', message, { exitCode: 2, details })
    this.name = 'UsageError'
  }
}
