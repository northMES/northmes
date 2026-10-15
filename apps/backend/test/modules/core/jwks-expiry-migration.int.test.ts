// SPDX-License-Identifier: AGPL-3.0-or-later
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryAsCore } from '@northmes/backend/testing';
import { emptyTemplateDatabase, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inRepoCatalog } from '../../../src/boot/boot.ts';
import { migrate } from '../../../src/migrate/runner.ts';
import { JWT_KEY_ROTATION_SECONDS } from '../../../src/modules/core/infrastructure/auth/auth-options.ts';

/** core's migrations folder. */
const coreMigrations = fileURLToPath(
  new URL('../../../src/modules/core/migrations', import.meta.url),
);

/** The migration that gives the JWT keys from before rotation an expiry. */
const expiryFile = readdirSync(coreMigrations).find((name) => name.endsWith('_jwks_expiry.sql'));

describe('the migration that gives older JWT keys an expiry', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  let dir = '';

  // core's catalog entry, with its migrations from migrationsDir.
  const catalogIn = (migrationsDir: string) =>
    inRepoCatalog({ modules: ['core'] }).map((entry) => ({ ...entry, migrationsDir }));

  beforeAll(async () => {
    // core's migration files up to, and without, the expiry.
    dir = mkdtempSync(join(tmpdir(), 'nm-jwks-expiry-'));
    for (const name of readdirSync(coreMigrations).sort()) {
      if (expiryFile !== undefined && name >= expiryFile) break;
      copyFileSync(join(coreMigrations, name), join(dir, name));
    }
    await migrate({ ownerUrl: db.ownerUrl, catalog: catalogIn(dir) });
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('E05-S05 a key Better Auth minted without an expiry expires 30 days after it was created, so it no longer signs forever', async () => {
    expect(expiryFile).toBeDefined();
    const insertKey = (age: string) =>
      queryAsCore<{ id: string }>(
        db.ownerUrl,
        `insert into auth.jwks ("publicKey", "privateKey", "createdAt")
         values ('{}', '{}', now() - $1::interval) returning id`,
        [age],
      );
    const [old] = await insertKey('40 days');
    const [recent] = await insertKey('5 days');

    await migrate({ ownerUrl: db.ownerUrl, catalog: catalogIn(coreMigrations) });

    const keys = await queryAsCore<{ id: string; lifetime: number; live: boolean }>(
      db.ownerUrl,
      `select id, extract(epoch from "expiresAt" - "createdAt")::int as lifetime,
              "expiresAt" > now() as live
         from auth.jwks order by "createdAt"`,
    );
    expect(keys).toEqual([
      { id: old?.id, lifetime: JWT_KEY_ROTATION_SECONDS, live: false },
      { id: recent?.id, lifetime: JWT_KEY_ROTATION_SECONDS, live: true },
    ]);
  });
});
