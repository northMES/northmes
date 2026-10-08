import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const ignored = ['**/node_modules/**', '**/dist/**', 'docs/sources/**'];

// graphql 16 ships index.js (CommonJS, "main") and index.mjs ("module"). Node loads index.js for
// packages in node_modules, while Vite resolves index.mjs for the code it transforms, and two
// copies break instanceof checks (ADR 0015). Every import of graphql gets the copy Node loads.
const graphql = fileURLToPath(import.meta.resolve('graphql'));

export default defineConfig({
  resolve: {
    conditions: ['@northmes/source'],
    alias: [{ find: /^graphql$/, replacement: graphql }],
  },
  ssr: { resolve: { conditions: ['@northmes/source'] } },
  // Vitest imports the global setup files in its own __vitest__ environment, which reads neither
  // resolve.conditions nor ssr.resolve.conditions. apps/server's setup imports server and workspace
  // source, which must not resolve to a stale dist/.
  environments: { __vitest__: { resolve: { conditions: ['@northmes/source'] } } },
  test: {
    // A run with --coverage reports on every source file in the tree that the projects collect tests
    // from, also one that no test loads, and leaves out the test files, declarations and fixtures.
    // Coverage is information only: the scheduling domain gets the first threshold
    // (docs/plan/11-quality-and-testing.md). CI / test publishes text-summary.txt in its job summary
    // and keeps the lcov report.
    coverage: {
      provider: 'v8',
      include: ['**/*.{ts,tsx,mts,mjs}'],
      exclude: [
        ...ignored,
        '**/fixtures/**',
        '**/*.test.{ts,tsx}',
        '**/*.test-d.ts',
        '**/*.d.{ts,mts}',
      ],
      reporter: ['text-summary', ['text-summary', { file: 'text-summary.txt' }], 'lcov'],
    },
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
          // The harness starts Postgres first; the server setup prepares its database after it.
          globalSetup: [
            './packages/testing/src/global-setup.ts',
            './apps/server/test/global-setup.ts',
          ],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'happy-dom',
          include: ['**/*.test.tsx'],
          exclude: ignored,
        },
      },
      {
        extends: true,
        test: {
          name: 'types',
          exclude: ignored,
          // Vitest runs tsc on one tsconfig for the whole project, and the repository root has no
          // tsconfig.json, so the types project names the one that includes every *.test-d.ts file.
          typecheck: {
            enabled: true,
            only: true,
            include: ['**/*.test-d.ts'],
            exclude: ignored,
            tsconfig: './tsconfig.types.json',
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'ai',
          include: ['**/*.ai.test.ts'],
          exclude: ignored,
        },
      },
      {
        extends: true,
        test: {
          name: 'ops',
          include: ['**/*.ops.test.ts'],
          exclude: ignored,
        },
      },
    ],
  },
});
