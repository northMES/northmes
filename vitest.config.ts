import { defineConfig } from 'vitest/config';

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
          exclude: [
            '**/*.int.test.ts',
            '**/*.ai.test.ts',
            '**/*.ops.test.ts',
            '**/node_modules/**',
            '**/dist/**',
            'docs/sources/**',
          ],
        },
      },
    ],
  },
});
