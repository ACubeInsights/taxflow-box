import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/__tests__/**/*.test.js',
      'src/**/__tests__/**/*.property.test.js',
    ],
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
});
