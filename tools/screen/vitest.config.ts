import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'tool-screen', include: ['test/**/*.test.ts'] },
})
