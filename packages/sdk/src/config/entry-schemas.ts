// SPDX-License-Identifier: MIT
import { z } from 'zod';
import { databaseUrl, nodeEnv, secretFile } from './keys.ts';

/** The environment of northmes migrate, which also serves northmes admin (ADR 0060). */
export const migrateEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  DATABASE_URL: databaseUrl,
  NORTHMES_DB_OWNER_PASSWORD_FILE: secretFile,
});

export type MigrateEnv = z.infer<typeof migrateEnvSchema>;

/**
 * The environment of northmes db bootstrap: the superuser's password file and the password file of
 * each login role it creates (ADR 0005, ADR 0060).
 */
export const bootstrapEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  DATABASE_URL: databaseUrl,
  POSTGRES_PASSWORD_FILE: secretFile,
  NORTHMES_DB_OWNER_PASSWORD_FILE: secretFile,
  NORTHMES_DB_APP_PASSWORD_FILE: secretFile,
  NORTHMES_DB_AUTH_PASSWORD_FILE: secretFile,
});

export type BootstrapEnv = z.infer<typeof bootstrapEnvSchema>;
