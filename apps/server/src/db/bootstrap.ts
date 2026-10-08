// SPDX-License-Identifier: AGPL-3.0-or-later
import { bootstrapEnvSchema, loadEnv, readSecrets } from '@northmes/sdk/config';
import { Client } from 'pg';
import type { BootOptions } from '../boot/boot.ts';

/** The passwords of the login roles that bootstrap creates, read from their secret files. */
export interface RolePasswords {
  readonly owner: string;
  readonly app: string;
  readonly auth: string;
}

/** The superuser of the official Postgres image, the login of db bootstrap (ADR 0060). */
const superuser = 'postgres';

/** The roles of ADR 0006 that bootstrap creates, with their attributes and password. */
const roles: readonly { name: string; attributes: string; password?: keyof RolePasswords }[] = [
  { name: 'nm_owner', attributes: 'login createrole', password: 'owner' },
  { name: 'nm_app', attributes: 'login nosuperuser nocreaterole nobypassrls', password: 'app' },
  { name: 'nm_auth', attributes: 'login', password: 'auth' },
  { name: 'nm_ext', attributes: 'nologin' },
];

/**
 * The role statements carry the passwords. These settings keep every statement of the session out
 * of the server log, whatever logging the server runs with. Postgres samples a transaction when it
 * starts, so they apply to the session and come before BEGIN.
 */
const unloggedSession = [
  "log_statement = 'none'",
  'log_min_duration_statement = -1',
  'log_min_duration_sample = -1',
  'log_transaction_sample_rate = 0',
  "log_min_error_statement = 'panic'",
];

/**
 * Creates the database roles as the superuser that superuserUrl logs in as (ADR 0005, ADR 0006):
 * nm_owner may create roles and gets CREATE on the URL's database, nm_app and nm_auth log in, and
 * nm_ext is a group that cannot log in, which nm_owner administers. Every role's time zone is pinned to UTC, per role because a
 * database cloned from a template loses its database settings. A role that exists keeps its
 * attributes and password, so a second run changes nothing.
 */
export async function bootstrapRoles(
  superuserUrl: string,
  passwords: RolePasswords,
): Promise<void> {
  const client = new Client({ connectionString: superuserUrl });
  await client.connect();
  try {
    for (const setting of unloggedSession) await client.query(`set ${setting}`);
    await client.query('begin');
    const { rows } = await client.query<{ database: string }>(
      'select current_database() as database',
    );
    const existing = await client.query<{ rolname: string }>(
      'select rolname from pg_roles where rolname = any($1)',
      [roles.map((role) => role.name)],
    );
    const exists = new Set(existing.rows.map((row) => row.rolname));
    for (const { name, attributes, password } of roles) {
      if (!exists.has(name)) {
        const secret = password ? ` password ${client.escapeLiteral(passwords[password])}` : '';
        await client.query(`create role ${name} ${attributes}${secret}`);
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
 * DATABASE_URL as the superuser and creates the roles with bootstrapRoles. It runs without the Nest
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
  const superuserUrl = new URL(bootstrapEnv.DATABASE_URL);
  superuserUrl.username = superuser;
  superuserUrl.password = secrets.POSTGRES_PASSWORD;
  await bootstrapRoles(superuserUrl.href, {
    owner: secrets.NORTHMES_DB_OWNER_PASSWORD,
    app: secrets.NORTHMES_DB_APP_PASSWORD,
    auth: secrets.NORTHMES_DB_AUTH_PASSWORD,
  });
  log.info(`Database roles in place: ${roles.map((role) => role.name).join(', ')}`);
}
