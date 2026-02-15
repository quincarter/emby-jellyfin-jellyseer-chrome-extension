import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.vitest.ts'],
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.vitest.ts',
        'src/**/*.styles.ts',
        'src/**/*.svg.ts',
        'src/**/index.ts',
        'src/sandbox/**',
        'src/styles/**',
        'src/assets/**',
        // Tested by WTR (web-test-runner), not vitest
        'src/components/**',
        'src/mixins/**',
        // Type-only files with no runtime code
        'src/types/api.ts',
        'src/types/media.ts',
        'src/types/messages.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
