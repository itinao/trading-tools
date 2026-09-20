import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-watch', include: ['test/**/*.test.ts'] },
})
