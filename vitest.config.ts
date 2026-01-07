import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'lib/**/*.test.ts',
      'tests/**/*.test.ts',
      'components/**/*.test.tsx',
      'hooks/**/*.test.ts',
      'bot/**/*.test.ts',
    ],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'lib/**/*.ts',
        'app/api/**/*.ts',
        'components/**/*.tsx',
        'hooks/**/*.ts',
        'bot/**/*.ts',
      ],
      exclude: [
        'node_modules',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  }
})
