import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    include: [
      'src/**/*.test.{js,jsx}',
      'src/**/*.property.test.{js,jsx}',
    ],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
})
