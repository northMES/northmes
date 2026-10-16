// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Server-only: entry points parse their environment with these schemas before Nest starts.
export { ConfigError } from './config-error.ts';
export {
  type BootstrapEnv,
  bootstrapEnvSchema,
  type MigrateEnv,
  migrateEnvSchema,
} from './entry-schemas.ts';
export { loadEnv } from './load-env.ts';
export { DEV_SECRET_MARKER, readSecrets, type Secrets, secretsConfig } from './secrets.ts';
export {
  type AdminEnv,
  adminEnvSchema,
  type ServerEnv,
  serverEnvSchema,
} from './server-env.ts';
