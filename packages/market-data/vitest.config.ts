import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'market-data', include: ['test/**/*.test.ts'] },
})
