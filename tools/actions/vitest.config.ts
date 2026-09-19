import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-actions', include: ['test/**/*.test.ts'] },
})
