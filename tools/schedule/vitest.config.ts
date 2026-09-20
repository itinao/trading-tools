import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-schedule', include: ['test/**/*.test.ts'] },
})
