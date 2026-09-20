import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-assess', include: ['test/**/*.test.ts'] },
})
