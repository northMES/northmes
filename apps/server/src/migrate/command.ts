// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadEnv, migrateEnvSchema } from '@northmes/sdk/config';
import type { BootOptions } from '../boot/boot.ts';

/** pnpm northmes migrate: reads migrateEnvSchema (ADR 0060). */
export async function migrateCommand({ env }: BootOptions): Promise<void> {
  loadEnv(migrateEnvSchema)(env);
}
