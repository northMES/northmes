// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type PostgresServer, query, startPostgres } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cli } from '../../src/cli.ts';

// Roles are server-wide, and the run's server already holds them, so this file bootstraps a server
// of its own (ADR 0005).
let server: PostgresServer;
let secretsDir: string;
// Logs in as the server's superuser, which bootstrap needs and the checks of the role catalog use.
let superuserUrl: string;

const passwords = {
  owner: randomBytes(16).toString('hex'),
  app: randomBytes(16).toString('hex'),
  auth: randomBytes(16).toString('hex'),
};

/** Writes a secret file that only its owner can read, as install.sh writes them. */
function writeSecret(name: string, value: string): string {
  const path = join(secretsDir, name);
  writeFileSync(path, `${value}\n`, { mode: 0o600 });
  return path;
}

/** Runs pnpm northmes db bootstrap with env and fails with its output when it exits. */
async function dbBootstrap(env: Record<string, string>): Promise<void> {
  const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
  const exit = vi.fn<(code: number) => void>();

  await cli(['db', 'bootstrap'], { env, exit, log });

  if (exit.mock.calls.length > 0) {
    throw new Error(`db bootstrap exited ${exit.mock.calls[0]?.[0]}: ${log.error.mock.calls}`);
  }
}

beforeAll(async () => {
  server = await startPostgres();
  secretsDir = mkdtempSync(join(tmpdir(), 'northmes-bootstrap-'));
  const { host, port, user, password, database } = server.connection;
  superuserUrl = `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

  await dbBootstrap({
    NODE_ENV: 'test',
    DATABASE_URL: `postgres://${host}:${port}/${database}`,
    POSTGRES_PASSWORD_FILE: writeSecret('postgres_password', password),
    NORTHMES_DB_OWNER_PASSWORD_FILE: writeSecret('db_owner_password', passwords.owner),
    NORTHMES_DB_APP_PASSWORD_FILE: writeSecret('db_app_password', passwords.app),
    NORTHMES_DB_AUTH_PASSWORD_FILE: writeSecret('db_auth_password', passwords.auth),
  });
}, 120_000);

afterAll(async () => {
  if (secretsDir) rmSync(secretsDir, { recursive: true, force: true });
  await server?.stop();
});

describe('pnpm northmes db bootstrap', () => {
  it('E02-S02 bootstrap creates nm_owner, nm_app, nm_auth and nm_ext, each with timezone UTC', async () => {
    const rows = await query(
      superuserUrl,
      `select r.rolname, r.rolcanlogin, r.rolcreaterole,
              has_database_privilege(r.oid, current_database(), 'CREATE') as creates_in_database,
              s.setconfig
         from pg_roles r
         left join pg_db_role_setting s on s.setrole = r.oid and s.setdatabase = 0
        where r.rolname like 'nm\\_%'
        order by r.rolname`,
    );

    expect(rows).toEqual([
      {
        rolname: 'nm_app',
        rolcanlogin: true,
        rolcreaterole: false,
        creates_in_database: false,
        setconfig: ['TimeZone=UTC'],
      },
      {
        rolname: 'nm_auth',
        rolcanlogin: true,
        rolcreaterole: false,
        creates_in_database: false,
        setconfig: ['TimeZone=UTC'],
      },
      {
        rolname: 'nm_ext',
        rolcanlogin: false,
        rolcreaterole: false,
        creates_in_database: false,
        setconfig: ['TimeZone=UTC'],
      },
      {
        rolname: 'nm_owner',
        rolcanlogin: true,
        rolcreaterole: true,
        creates_in_database: true,
        setconfig: ['TimeZone=UTC'],
      },
    ]);
  });
});
