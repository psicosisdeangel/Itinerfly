import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Vitest necesita saber que estos archivos son CommonJS
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    include: ['src/tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: ['src/mock/**', 'src/tests/**'],

    }
  }
})