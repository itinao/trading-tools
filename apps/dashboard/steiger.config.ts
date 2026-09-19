import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

/**
 * FSD の層・スライス・公開 API を検査する（Design Doc 0006 §3.4）。
 * - routes/ は TanStack Router の規約上の場所で層ではないため対象外
 * - insignificant-slice（参照が1つのスライスは統合せよ）は、M2 以降で再利用する前提で分けているため無効
 */
export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['**/routes/**', '**/routeTree.gen.ts'],
    rules: { 'fsd/insignificant-slice': 'off' },
  },
])
