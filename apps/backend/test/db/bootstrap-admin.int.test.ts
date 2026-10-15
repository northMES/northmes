// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type PostgresServer, query, startPostgres } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cli } from '../../src/cli.ts';

// A managed Postgres (Azure, RDS, a shared company server) gives an admin with CREATEROLE, not a
// superuser, and a database next to others on the same server. This file builds that on a server
// of its own, because roles are server-wide (ADR 0005, ADR 0080).
let server: PostgresServer;
let secretsDir: string;
let superuserUrl: string;
let env: Record<string, string>;

const admin = { user: 'northmes_admin', password: randomBytes(16).toString('hex') };
const database = 'northmes_shared';
const passwords = {
  owner: randomBytes(16).toString('hex'),
  app: randomBytes(16).toString('hex'),
  auth: randomBytes(16).toString('hex'),
};

/** A URL to the shared database that logs in as role with password. */
function urlFor(role: string, password: string): string {
  const { host, port } = server.connection;
  return `postgres://${role}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

/** Writes a secret file that only its owner can read. */
function writeSecret(name: string, value: string): string {
  const path = join(secretsDir, name);
  writeFileSync(path, `${value}\n`, { mode: 0o600 });
  return path;
}

/** Runs pnpm northmes with args and env and fails with its output when it exits. */
async function northmes(args: string[]): Promise<string[]> {
  const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
  const exit = vi.fn<(code: number) => void>();

  await cli(args, { env, exit, log });

  if (exit.mock.calls.length > 0) {
    throw new Error(`${args.join(' ')} exited ${exit.mock.calls[0]?.[0]}: ${log.error.mock.calls}`);
  }
  return log.info.mock.calls.map(([line]) => line);
}

beforeAll(async () => {
  // The server logs every statement, and an admin that is not a superuser cannot turn that off for
  // its session, so a role statement that carries a password puts it in the log.
  server = await startPostgres({
    settings: {
      log_statement: 'all',
      log_min_duration_statement: '0',
      log_min_error_statement: 'debug5',
    },
  });
  secretsDir = mkdtempSync(join(tmpdir(), 'northmes-bootstrap-admin-'));
  const { host, port, user, password } = server.connection;
  superuserUrl = `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
  // What the server's operator hands over: an admin that may create roles, and a database it owns.
  await query(
    superuserUrl,
    `create role ${admin.user} login createrole password '${admin.password}'`,
  );
  await query(superuserUrl, `create database ${database} owner ${admin.user}`);
  env = {
    NODE_ENV: 'test',
    DATABASE_URL: `postgres://${host}:${port}/${database}`,
    NORTHMES_DB_ADMIN_USER: admin.user,
    POSTGRES_PASSWORD_FILE: writeSecret('postgres_password', admin.password),
    NORTHMES_DB_OWNER_PASSWORD_FILE: writeSecret('db_owner_password', passwords.owner),
    NORTHMES_DB_APP_PASSWORD_FILE: writeSecret('db_app_password', passwords.app),
    NORTHMES_DB_AUTH_PASSWORD_FILE: writeSecret('db_auth_password', passwords.auth),
  };
  // The first run creates the roles, which is the run whose statements carry the passwords.
  await northmes(['db', 'bootstrap']);
}, 120_000);

afterAll(async () => {
  if (secretsDir) rmSync(secretsDir, { recursive: true, force: true });
  await server?.stop();
});

describe('an external Postgres with an admin that is not a superuser (ADR 0080)', () => {
  it('ADR0080 db bootstrap as NORTHMES_DB_ADMIN_USER creates the roles, a second run changes nothing, and migrate runs as nm_owner', async () => {
    await northmes(['db', 'bootstrap']);
    const migrated = await northmes(['migrate']);

    expect(
      await query(
        superuserUrl,
        `select rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
           from pg_roles
          where rolname in ('nm_owner', 'nm_app', 'nm_auth', 'nm_ext')
          order by rolname`,
      ),
    ).toEqual(
      ['nm_app', 'nm_auth', 'nm_ext', 'nm_owner'].map((rolname) => ({
        rolname,
        rolsuper: false,
        rolcreaterole: rolname === 'nm_owner',
        rolcreatedb: false,
        rolreplication: false,
        rolbypassrls: false,
      })),
    );
    expect(migrated.at(-1)).toBe('Migrations up to date');
    expect(await query(urlFor('nm_app', passwords.app), 'select current_user')).toEqual([
      { current_user: 'nm_app' },
    ]);
  });

  it('ADR0080 db bootstrap as an admin that is not a superuser writes no role password to the server log', async () => {
    const probe = `nm_log_probe_${randomBytes(4).toString('hex')}`;
    // The probe runs after bootstrap, so once it is in the log, every line bootstrap caused is too.
    await query(superuserUrl, `select '${probe}'`);
    await vi.waitFor(
      async () => {
        expect(await server.logs()).toContain(probe);
      },
      { timeout: 5_000 },
    );

    const log = await server.logs();
    const logged = Object.entries(passwords)
      .filter(([, password]) => log.includes(password))
      .map(([role]) => role);

    expect(logged).toEqual([]);
  });
});
