// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/pool-error-listener.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** Every TypeScript and JavaScript file in the repository, outside docs/ and build output. */
function sourceFiles(): { path: string; text: string }[] {
  return globSync('**/*.{ts,mts,cts,tsx,js,mjs,cjs}', {
    cwd: root,
    exclude: ['**/node_modules', '**/dist', '**/.turbo', 'docs', 'coverage'],
  })
    .sort()
    .map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));
}

describe('pool-error-listener', () => {
  it('ADR0041 every pg pool in the repository gets an error listener before use', () => {
    expect(scan(sourceFiles())).toEqual([]);
  });

  it('ADR0041 a pool without an error listener fails naming the file and the line', () => {
    const findings = scan([
      {
        path: 'apps/backend/test/listened.int.test.ts',
        text: [
          "import { Pool } from 'pg';",
          'const pool = new Pool({ connectionString: url });',
          "pool.on('error', () => {});",
          "await pool.query('select 1');",
        ].join('\n'),
      },
      {
        path: 'apps/backend/test/unlistened.int.test.ts',
        text: [
          "import pg from 'pg';",
          'let pool: pg.Pool | undefined;',
          'beforeAll(() => {',
          '  pool = new pg.Pool({ connectionString: url });',
          '});',
          'afterAll(async () => {',
          '  await pool?.end();',
          '});',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([{ path: 'apps/backend/test/unlistened.int.test.ts', line: 4 }]);
  });

  it('ADR0041 a pool used before its error listener is a finding', () => {
    const path = 'packages/testing/src/late.ts';

    const findings = scan([
      {
        path,
        text: [
          "import { Pool } from 'pg';",
          'const pool = new Pool({ connectionString: url });',
          "await pool.query('select 1');",
          "pool.on('error', () => {});",
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([{ path, line: 2 }]);
  });

  it('ADR0041 a pool handed straight to another call has no listener and is a finding', () => {
    const path = 'apps/backend/test/inline.int.test.ts';

    const findings = scan([
      {
        path,
        text: [
          "import { Pool } from 'pg';",
          'const dialect = new PostgresDialect({',
          '  pool: new Pool({ connectionString: url }),',
          '});',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([{ path, line: 3 }]);
  });

  it('ADR0041 a listener on a property that holds the pool counts, and one for another event does not', () => {
    const path = 'scripts/stack/pools.mjs';

    const findings = scan([
      {
        path,
        text: [
          'this.pool = new pg.Pool({ connectionString: url });',
          'this.pool.on("error", () => {});',
          'const other = new pg.Pool({ connectionString: url });',
          "other.on('connect', () => {});",
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([{ path, line: 3 }]);
  });

  it('ADR0041 a Pool in a comment or a string is not a finding', () => {
    const findings = scan([
      {
        path: 'apps/backend/src/db/notes.ts',
        text: [
          '// const pool = new Pool({ connectionString: url });',
          "const example = 'new Pool({ connectionString })';",
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([]);
  });
});
