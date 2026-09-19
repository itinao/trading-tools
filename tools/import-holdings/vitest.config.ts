import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-import-holdings', include: ['test/**/*.test.ts'] },
})
