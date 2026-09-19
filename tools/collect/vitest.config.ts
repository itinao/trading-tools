import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-collect', include: ['test/**/*.test.ts'] },
})
