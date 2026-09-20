import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-advise', include: ['test/**/*.test.ts'] },
})
