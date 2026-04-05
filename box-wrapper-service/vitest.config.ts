import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/property/**/*.property.test.ts',
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
