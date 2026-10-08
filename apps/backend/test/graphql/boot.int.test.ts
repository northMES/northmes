// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { emptyTemplateDatabase, query, useTestDatabase } from '@northmes/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { migrateCommand } from '../../src/migrate/command.ts';
import { fixtureCatalog } from '../fixtures/graphql/catalog.ts';
import { gamma } from '../fixtures/graphql/unprefixed.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';

/** Collects the lines boot writes. */
function recordingLog() {
  return { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
}

/** The message of a boot whose fixture module gamma has a root field without its prefix. */
const unprefixedRootField = [
  'refused to start (1 problem)',
  '- [NORTHMES_ROOT_FIELD_PREFIX] Query.ping of module gamma must start with "gamma" and an upper-case letter',
].join('\n');

describe('boot with a root field outside its module prefix', () => {
  const env = useServerEnv();
  let app: INestApplication | undefined;

  // ConfigModule writes the validated environment into process.env, as it does in the server. The
  // stubs remove these keys for each test, and unstubAllEnvs takes them out again afterwards.
  beforeEach(() => {
    for (const key of serverEnvKeys) vi.stubEnv(key, undefined);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.unstubAllEnvs();
  });

  it('E02-S03 a root field without its module prefix exits with code 1', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();

    app = await boot({
      env,
      ...fixtureCatalog(gamma),
      exit,
      log,
    });

    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([[unprefixedRootField]]);
  });
});

describe('pnpm northmes migrate with a root field outside its module prefix', () => {
  // The database holds only what migrate applies, so a run that started would leave its records.
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'northmes-migrate-'));
    // The package of gamma's manifest, with one migration file.
    mkdirSync(join(dir, 'gamma', 'migrations'), { recursive: true });
    writeFileSync(join(dir, 'gamma', 'package.json'), '{}\n');
    writeFileSync(
      join(dir, 'gamma', 'migrations', '20260110080000_ping.sql'),
      'create table gamma.ping (id int primary key);\n',
    );
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * The environment of migrate: DATABASE_URL without a login and the owner's password in a secret
   * file. The keys are stubbed, so ConfigModule's writes to process.env end with the test.
   */
  function migrateEnv(): Record<string, string> {
    for (const key of ['DATABASE_URL', 'NORTHMES_DB_OWNER_PASSWORD_FILE'])
      vi.stubEnv(key, undefined);
    const databaseUrl = new URL(db.ownerUrl);
    const passwordFile = join(dir, 'db_owner_password');
    writeFileSync(passwordFile, `${decodeURIComponent(databaseUrl.password)}\n`, { mode: 0o600 });
    databaseUrl.username = '';
    databaseUrl.password = '';
    return {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl.href,
      NORTHMES_DB_OWNER_PASSWORD_FILE: passwordFile,
    };
  }

  it('E02-S03 northmes migrate with a root field outside its module prefix exits 1 before its first file', async () => {
    const run = migrateCommand({
      env: migrateEnv(),
      ...fixtureCatalog(gamma),
      resolveManifest: () => pathToFileURL(join(dir, 'gamma', 'manifest.js')).href,
      exit: vi.fn<(code: number) => void>(),
      log: recordingLog(),
    });

    // pnpm northmes migrate ends with the exit code of the BootError it stops on.
    await expect(run).rejects.toThrow(
      expect.objectContaining({ message: unprefixedRootField, exitCode: 1 }),
    );
    // A run that started would have created the migration records and gamma's schema.
    expect(
      await query(
        db.ownerUrl,
        "select nspname from pg_namespace where nspname in ('northmes_meta', 'gamma')",
      ),
    ).toEqual([]);
  });
});
