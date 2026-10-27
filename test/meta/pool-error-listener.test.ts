// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/pool-error-listener.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

const extensions = ['ts', 'mts', 'cts', 'tsx', 'js', 'mjs', 'cjs'];

/** Every TypeScript and JavaScript file that git tracks, outside docs/. */
function sourceFiles(): { path: string; text: string }[] {
  const pathspecs = [...extensions.map((extension) => `*.${extension}`), ':!docs/'];
  return execFileSync('git', ['ls-files', '-z', '--', ...pathspecs], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter((path) => path !== '' && existsSync(join(root, path)))
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

  it('ADR0041 a once listener is a finding, because the drop of a database ends each idle connection with an error of its own', () => {
    const path = 'apps/backend/test/once.int.test.ts';

    const findings = scan([
      {
        path,
        text: [
          "import { Pool } from 'pg';",
          'const pool = new Pool({ connectionString: url });',
          "pool.once('error', () => {});",
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([{ path, line: 2 }]);
  });

  it('ADR0041 a listener chained on the construction counts', () => {
    const findings = scan([
      {
        path: 'apps/backend/test/chained.int.test.ts',
        text: [
          "import { Pool } from 'pg';",
          "const pool = new Pool({ connectionString: url }).on('error', () => {});",
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([]);
  });

  it('ADR0041 a pool constructed under another name from pg or pg-pool is checked too', () => {
    const path = 'apps/backend/test/renamed.int.test.ts';

    const findings = scan([
      {
        path,
        text: [
          "import { Pool as PgPool } from 'pg';",
          "import BarePool from 'pg-pool';",
          "import * as postgres from 'pg';",
          'const first = new PgPool({ connectionString: url });',
          'const second = new BarePool({ connectionString: url });',
          'const third = new (postgres.Pool)({ connectionString: url });',
          'const fourth = new postgres.default.Pool({ connectionString: url });',
          'const map = new Map();',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      { path, line: 4 },
      { path, line: 5 },
      { path, line: 6 },
      { path, line: 7 },
    ]);
  });

  it('ADR0041 a listener counts only as a statement of the block that constructs the pool, so a conditional or a later hook does not', () => {
    const path = 'apps/backend/test/order.int.test.ts';

    const findings = scan([
      {
        path,
        text: [
          "import { Pool } from 'pg';",
          'const first = new Pool({ connectionString: url });',
          "if (debug) first.on('error', () => {});",
          'let second: Pool | undefined;',
          'beforeAll(() => {',
          '  second = new Pool({ connectionString: url });',
          '});',
          'afterAll(async () => {',
          "  second?.on('error', () => {});",
          '  await second?.end();',
          '});',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      { path, line: 2 },
      { path, line: 6 },
    ]);
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

  it('ADR0041 a pg Client in test code needs an error listener before use, like a pool', () => {
    const findings = scan([
      {
        path: 'apps/backend/test/modules/core/listened.int.test.ts',
        text: [
          "import { Client } from 'pg';",
          'const client = new Client({ connectionString: url });',
          "client.on('error', () => {});",
          'await client.connect();',
        ].join('\n'),
      },
      {
        path: 'apps/backend/test/modules/core/unlistened.int.test.ts',
        text: [
          "import { Client } from 'pg';",
          'async function open(): Promise<Client> {',
          '  const client = new Client({ connectionString: url });',
          '  await client.connect();',
          '  return client;',
          '}',
        ].join('\n'),
      },
      {
        path: 'e2e/fixtures.ts',
        text: [
          "import pg from 'pg';",
          'const client = new pg.Client({ connectionString: url });',
          "client.once('error', () => {});",
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      { path: 'apps/backend/test/modules/core/unlistened.int.test.ts', line: 3 },
      { path: 'e2e/fixtures.ts', line: 2 },
    ]);
  });

  it('ADR0041 test code is a test file, a file under test/ or e2e/, the testing package and a testing module', () => {
    const unlistened = [
      "import { Client } from 'pg';",
      'const client = new Client({ connectionString: url });',
      'await client.connect();',
    ].join('\n');
    const paths = [
      'scripts/stack/dev-up.int.test.ts',
      'modules/planning/backend/src/orders.test.ts',
      'apps/backend/test/global-setup.ts',
      'e2e/support/database.ts',
      'packages/testing/src/client.ts',
      'apps/backend/src/testing.ts',
      'apps/web/src/testing.tsx',
      'apps/backend/src/testing/core-owner.ts',
      'apps/backend/src/migrate/runner.ts',
      'scripts/stack/seed.mjs',
    ];

    const findings = scan(paths.map((path) => ({ path, text: unlistened })));

    expect(findings).toEqual(paths.slice(0, 8).map((path) => ({ path, line: 2 })));
  });

  it('ADR0041 a Client destructured from pg is checked too', () => {
    const path = 'e2e/support/clients.ts';

    const findings = scan([
      {
        path,
        text: [
          "import pg from 'pg';",
          'const { Client, Pool: PgPool } = pg;',
          'const { Client: Renamed } = pg;',
          'const first = new Client({ connectionString: url });',
          'const second = new Renamed({ connectionString: url });',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      { path, line: 4 },
      { path, line: 5 },
    ]);
  });

  it('ADR0041 a Client required from pg in CommonJS is checked too', () => {
    const path = 'scripts/stack/clients.test.cjs';

    const findings = scan([
      {
        path,
        text: [
          "const pg = require('pg');",
          "const { Client } = require('pg');",
          'const first = new pg.Client({ connectionString: url });',
          'const second = new Client({ connectionString: url });',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      { path, line: 3 },
      { path, line: 4 },
    ]);
  });

  it('ADR0041 a Client counts only when it comes from pg, under any name', () => {
    const path = 'apps/backend/test/clients.int.test.ts';

    const findings = scan([
      {
        path,
        text: [
          "import { Client as PgClient } from 'pg';",
          "import * as postgres from 'pg';",
          "import { Client } from 'some-other-library';",
          "import * as other from 'some-other-library';",
          'const first = new PgClient({ connectionString: url });',
          'const second = new (postgres.Client)({ connectionString: url });',
          'const third = new postgres.default.Client({ connectionString: url });',
          'const fourth = new Client();',
          'const fifth = new other.Client();',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      { path, line: 5 },
      { path, line: 6 },
      { path, line: 7 },
    ]);
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
