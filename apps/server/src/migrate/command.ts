// SPDX-License-Identifier: AGPL-3.0-or-later
import { type BootOptions, bootForMigrate } from '../boot/boot.ts';
import { migrate } from './runner.ts';

/** The login of pnpm northmes migrate (ADR 0006). */
const owner = 'nm_owner';

/**
 * pnpm northmes migrate: runs the boot steps without listening (bootForMigrate) and logs the files
 * that its migration check found pending, then applies the catalog's migration files as nm_owner
 * on DATABASE_URL, with the password from the owner's secret file. The app closes afterwards.
 */
export async function migrateCommand(options: BootOptions): Promise<void> {
  const { env, secrets, catalog, pending, app } = await bootForMigrate(options);
  try {
    for (const file of pending) options.log.info(`Pending ${file}`);
    const ownerUrl = new URL(env.DATABASE_URL);
    ownerUrl.username = owner;
    ownerUrl.password = secrets.NORTHMES_DB_OWNER_PASSWORD;
    const { applied } = await migrate({ ownerUrl: ownerUrl.href, catalog });
    for (const file of applied) options.log.info(`Applied ${file}`);
    options.log.info('Migrations up to date');
  } finally {
    await app.close();
  }
}
