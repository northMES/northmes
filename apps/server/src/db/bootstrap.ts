// SPDX-License-Identifier: AGPL-3.0-or-later
import { bootstrapEnvSchema, loadEnv, readSecrets } from '@northmes/sdk/config';
import { Client } from 'pg';
import type { BootOptions } from '../boot/boot.ts';

/** The superuser of the official Postgres image, the login of db bootstrap (ADR 0060). */
const superuser = 'postgres';

/** The roles of ADR 0006 that bootstrap creates, with their attributes. */
const roles: readonly { name: string; attributes: string }[] = [
  { name: 'nm_owner', attributes: 'login createrole' },
  { name: 'nm_app', attributes: 'login nosuperuser nocreaterole nobypassrls' },
  { name: 'nm_auth', attributes: 'login' },
  { name: 'nm_ext', attributes: 'nologin' },
];

/**
 * Creates the database roles as the superuser that superuserUrl logs in as (ADR 0005, ADR 0006):
 * nm_owner may create roles and gets CREATE on the URL's database, nm_app and nm_auth log in, and
 * nm_ext is a group that cannot log in. Every role's time zone is pinned to UTC, per role because a
 * database cloned from a template loses its database settings.
 */
export async function bootstrapRoles(superuserUrl: string): Promise<void> {
  const client = new Client({ connectionString: superuserUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ database: string }>(
      'select current_database() as database',
    );
    await client.query('begin');
    for (const { name, attributes } of roles) {
      await client.query(`create role ${name} ${attributes}`);
      await client.query(`alter role ${name} set timezone = 'UTC'`);
    }
    const database = client.escapeIdentifier(rows[0]?.database ?? '');
    await client.query(`grant create on database ${database} to nm_owner`);
    await client.query('commit');
  } finally {
    await client.end();
  }
}

/**
 * pnpm northmes db bootstrap: reads bootstrapEnvSchema and the superuser's secret file, logs in to
 * DATABASE_URL as the superuser and creates the roles with bootstrapRoles. It runs without the Nest
 * app (ADR 0060).
 */
export async function dbBootstrap({ env, log }: Pick<BootOptions, 'env' | 'log'>): Promise<void> {
  const bootstrapEnv = loadEnv(bootstrapEnvSchema)(env);
  const secrets = readSecrets(
    { POSTGRES_PASSWORD_FILE: bootstrapEnv.POSTGRES_PASSWORD_FILE },
    { nodeEnv: bootstrapEnv.NODE_ENV },
  );
  const superuserUrl = new URL(bootstrapEnv.DATABASE_URL);
  superuserUrl.username = superuser;
  superuserUrl.password = secrets.POSTGRES_PASSWORD;
  await bootstrapRoles(superuserUrl.href);
  log.info(`Database roles in place: ${roles.map((role) => role.name).join(', ')}`);
}
