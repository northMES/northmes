import { defineConfig } from 'vitest/config';

const ignored = ['**/node_modules/**', '**/dist/**', 'docs/sources/**'];

export default defineConfig({
  resolve: { conditions: ['@northmes/source'] },
  ssr: { resolve: { conditions: ['@northmes/source'] } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['**/*.test.ts'],
          exclude: ['**/*.int.test.ts', '**/*.ai.test.ts', '**/*.ops.test.ts', ...ignored],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['**/*.int.test.ts'],
          exclude: ignored,
          globalSetup: ['./packages/testing/src/global-setup.ts'],
        },
      },
    ],
  },
});
