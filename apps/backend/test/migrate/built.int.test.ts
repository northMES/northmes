// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootBuilt, emptyTemplateDatabase, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** The migration files in the migrations folder of an in-repo module, as migrate names them. */
function migrationFiles(module: string): string[] {
  const dir = fileURLToPath(new URL(`../../src/modules/${module}/migrations/`, import.meta.url));
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => `${module}/${name}`);
}

describe('pnpm northmes migrate on the built server', () => {
  // The database holds nothing yet, so the run applies every file of the in-repo modules.
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  let secretsDir: string;

  beforeAll(() => {
    secretsDir = mkdtempSync(join(tmpdir(), 'northmes-built-migrate-'));
  });

  afterAll(() => {
    rmSync(secretsDir, { recursive: true, force: true });
  });

  it("E02-S08 the built server's migrate applies the migration files of the in-repo modules", {
    timeout: 120_000,
  }, async () => {
    const databaseUrl = new URL(db.ownerUrl);
    const ownerPasswordFile = join(secretsDir, 'db_owner_password');
    writeFileSync(ownerPasswordFile, `${decodeURIComponent(databaseUrl.password)}\n`, {
      mode: 0o600,
    });
    databaseUrl.username = '';
    databaseUrl.password = '';

    const { exitCode, stdout, stderr } = await bootBuilt({
      args: ['migrate'],
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl.href,
        NORTHMES_DB_OWNER_PASSWORD_FILE: ownerPasswordFile,
      },
    });
    const applied = stdout
      .split('\n')
      .filter((line) => line.startsWith('Applied '))
      .map((line) => line.slice('Applied '.length));

    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
    expect(applied).toEqual([...migrationFiles('core'), ...migrationFiles('planning')]);
  });
});
