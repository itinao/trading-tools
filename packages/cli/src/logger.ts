export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const order: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

/** stderr に人向けのログを書く。stdout は JSON 専用なので使わない。 */
export class Logger {
  constructor(
    private readonly write: (line: string) => void,
    private readonly threshold: LogLevel,
  ) {}

  debug(message: string): void {
    this.log('debug', message)
  }
  info(message: string): void {
    this.log('info', message)
  }
  warn(message: string): void {
    this.log('warn', message)
  }
  error(message: string): void {
    this.log('error', message)
  }

  private log(level: LogLevel, message: string): void {
    if (order[level] < order[this.threshold]) return
    this.write(`[${level}] ${message}\n`)
  }
}

export function levelFromOptions(options: { quiet: boolean; verbose: boolean }): LogLevel {
  if (options.quiet) return 'error'
  if (options.verbose) return 'debug'
  return 'info'
}
