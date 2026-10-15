// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { bootstrapEnvSchema, loadEnv, readSecrets } from '@northmes/sdk/config';
import { Client } from 'pg';
import type { BootOptions } from '../boot/boot.ts';

/** The passwords of the login roles that bootstrap creates, read from their secret files. */
export interface RolePasswords {
  readonly owner: string;
  readonly app: string;
  readonly auth: string;
}

/** The role attributes bootstrap sets, each with its pg_roles column. */
const attributes = {
  login: 'rolcanlogin',
  createrole: 'rolcreaterole',
  superuser: 'rolsuper',
  createdb: 'rolcreatedb',
  replication: 'rolreplication',
  bypassrls: 'rolbypassrls',
} as const;

type Attribute = keyof typeof attributes;

/**
 * The roles of ADR 0006 that bootstrap creates, with the attributes they hold and their password.
 * Every other attribute is withheld, so a role made by hand loses SUPERUSER, CREATEDB, REPLICATION
 * and BYPASSRLS.
 */
const roles: readonly {
  name: string;
  holds: readonly Attribute[];
  password?: keyof RolePasswords;
}[] = [
  { name: 'nm_owner', holds: ['login', 'createrole'], password: 'owner' },
  { name: 'nm_app', holds: ['login'], password: 'app' },
  { name: 'nm_auth', holds: ['login'], password: 'auth' },
  { name: 'nm_ext', holds: [] },
];

/** The attribute clauses that give role attribute the value it should hold, as in "nologin". */
function clause(holds: readonly Attribute[], attribute: Attribute): string {
  return holds.includes(attribute) ? attribute : `no${attribute}`;
}

/**
 * These settings keep every statement of the session out of the server log, whatever logging the
 * server runs with. Postgres samples a transaction when it starts, so they apply to the session and
 * come before BEGIN. Only a superuser may set them, so an admin with CREATEROLE on an external server
 * runs without them (ADR 0080).
 */
const unloggedSession = [
  "log_statement = 'none'",
  'log_min_duration_statement = -1',
  'log_min_duration_sample = -1',
  'log_transaction_sample_rate = 0',
  "log_min_error_statement = 'panic'",
];

/**
 * The SCRAM-SHA-256 secret of password (RFC 5802, RFC 7677), in the form Postgres stores in
 * pg_authid. A role statement carries this secret, never the password, so neither the server log nor
 * the statement statistics of a server that logs every statement hold a password.
 */
function scramSecret(password: string): string {
  const iterations = 4096;
  const salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest('base64');
  const serverKey = createHmac('sha256', salted).update('Server Key').digest('base64');
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey}:${serverKey}`;
}

/**
 * Creates the database roles as the admin that adminUrl logs in as, a superuser or a role with
 * CREATEROLE (ADR 0005, ADR 0006, ADR 0080):
 * nm_owner may create roles and gets CREATE on the URL's database, nm_app and nm_auth log in, and
 * nm_ext is a group that cannot log in, which nm_owner administers. Every role's time zone is
 * pinned to UTC, per role because a database cloned from a template loses its database settings.
 * A role that exists keeps its password and gets back the attributes it should hold, so a role made
 * by hand loses SUPERUSER, CREATEDB, REPLICATION and BYPASSRLS, and CREATEROLE unless it is
 * nm_owner. A second run changes nothing. Role names and attributes are constants of this file, never input.
 */
export async function bootstrapRoles(adminUrl: string, passwords: RolePasswords): Promise<void> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const admin = await client.query<{ rolsuper: boolean }>(
      'select rolsuper from pg_roles where rolname = current_user',
    );
    if (admin.rows[0]?.rolsuper) {
      for (const setting of unloggedSession) await client.query(`set ${setting}`);
    }
    await client.query('begin');
    const { rows } = await client.query<{ database: string }>(
      'select current_database() as database',
    );
    const existing = await client.query<{ rolname: string } & Record<string, boolean>>(
      `select rolname, ${Object.values(attributes).join(', ')} from pg_roles where rolname = any($1)`,
      [roles.map((role) => role.name)],
    );
    const found = new Map(existing.rows.map((row) => [row.rolname, row]));
    const names = Object.keys(attributes) as Attribute[];
    for (const { name, holds, password } of roles) {
      const role = found.get(name);
      if (!role) {
        const secret = password
          ? ` password ${client.escapeLiteral(scramSecret(passwords[password]))}`
          : '';
        const clauses = names.map((attribute) => clause(holds, attribute)).join(' ');
        await client.query(`create role ${name} ${clauses}${secret}`);
      } else {
        // Only a superuser may name SUPERUSER, REPLICATION or BYPASSRLS, even to keep them off, so
        // the statement names only the attributes that change (ADR 0080).
        const changes = names.filter(
          (attribute) => role[attributes[attribute]] !== holds.includes(attribute),
        );
        if (changes.length > 0) {
          const clauses = changes.map((attribute) => clause(holds, attribute)).join(' ');
          await client.query(`alter role ${name} ${clauses}`);
        }
      }
      await client.query(`alter role ${name} set timezone = 'UTC'`);
    }
    const database = client.escapeIdentifier(rows[0]?.database ?? '');
    await client.query(`grant create on database ${database} to nm_owner`);
    // migrate makes each module role a member of nm_ext, which takes ADMIN on nm_ext. nm_owner
    // gets none of the group's rights.
    await client.query('grant nm_ext to nm_owner with admin true, inherit false, set false');
    await client.query('commit');
  } finally {
    await client.end();
  }
}

/**
 * pnpm northmes db bootstrap: reads bootstrapEnvSchema and the secret files it names, logs in to
 * DATABASE_URL as NORTHMES_DB_ADMIN_USER and creates the roles with bootstrapRoles. It runs without the Nest
 * app (ADR 0060).
 */
export async function dbBootstrap({ env, log }: Pick<BootOptions, 'env' | 'log'>): Promise<void> {
  const bootstrapEnv = loadEnv(bootstrapEnvSchema)(env);
  const secrets = readSecrets(
    {
      POSTGRES_PASSWORD_FILE: bootstrapEnv.POSTGRES_PASSWORD_FILE,
      NORTHMES_DB_OWNER_PASSWORD_FILE: bootstrapEnv.NORTHMES_DB_OWNER_PASSWORD_FILE,
      NORTHMES_DB_APP_PASSWORD_FILE: bootstrapEnv.NORTHMES_DB_APP_PASSWORD_FILE,
      NORTHMES_DB_AUTH_PASSWORD_FILE: bootstrapEnv.NORTHMES_DB_AUTH_PASSWORD_FILE,
    },
    { nodeEnv: bootstrapEnv.NODE_ENV },
  );
  const adminUrl = new URL(bootstrapEnv.DATABASE_URL);
  adminUrl.username = bootstrapEnv.NORTHMES_DB_ADMIN_USER;
  adminUrl.password = secrets.POSTGRES_PASSWORD;
  await bootstrapRoles(adminUrl.href, {
    owner: secrets.NORTHMES_DB_OWNER_PASSWORD,
    app: secrets.NORTHMES_DB_APP_PASSWORD,
    auth: secrets.NORTHMES_DB_AUTH_PASSWORD,
  });
  log.info(`Database roles in place: ${roles.map((role) => role.name).join(', ')}`);
}
