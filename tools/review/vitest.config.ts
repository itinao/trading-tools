import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-review', include: ['test/**/*.test.ts'] },
})
