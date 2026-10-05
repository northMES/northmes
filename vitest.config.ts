import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
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
