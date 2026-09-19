import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-db', include: ['test/**/*.test.ts'] },
})
