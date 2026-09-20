import { join } from 'node:path'
import { findWorkspaceRoot, UsageError } from '@trading/cli'
import type { Target } from '@trading/domain'
import {
  createGoogleNewsProvider,
  createMockProvider,
  createTdnetProvider,
  createYahooProvider,
  type DisclosureProvider,
  type FinancialsProvider,
  type FundamentalsProvider,
  type NewsProvider,
  type QuoteProvider,
} from '@trading/market-data'

export const MOCK_QUOTES_PATH = 'data/source/mock-quotes.json'

/** collect が使う Provider 一式。テストでは偽物を注入する */
export interface Providers {
  quotes: QuoteProvider
  fundamentals: FundamentalsProvider
  financials: FinancialsProvider
  news: NewsProvider
  disclosures: DisclosureProvider
}

let yahoo: ReturnType<typeof createYahooProvider> | undefined
const getYahoo = () => {
  yahoo ??= createYahooProvider()
  return yahoo
}

/** 株価の Provider: --provider > TRADING_QUOTE_PROVIDER > yahoo（Design Doc 0010 で既定を mock から変更） */
export function resolveQuoteProvider(
  name: string | undefined,
  env: NodeJS.ProcessEnv,
  targets: Target[],
): QuoteProvider {
  const selected = name ?? env.TRADING_QUOTE_PROVIDER ?? 'yahoo'
  switch (selected) {
    case 'yahoo':
      return getYahoo()
    case 'mock':
      return createMockProvider({
        filePath: join(findWorkspaceRoot(), MOCK_QUOTES_PATH),
        seed: () => Object.fromEntries(targets.map((t) => [t.code, t.priceAtSnapshot])),
      })
    default:
      throw new UsageError(`未知の provider: ${selected}`, { known: ['yahoo', 'mock'] })
  }
}

export function defaultProviders(
  quoteProviderName: string | undefined,
  env: NodeJS.ProcessEnv,
  targets: Target[],
): Providers {
  return {
    quotes: resolveQuoteProvider(quoteProviderName, env, targets),
    fundamentals: getYahoo(),
    financials: getYahoo(),
    news: createGoogleNewsProvider(),
    disclosures: createTdnetProvider(),
  }
}
