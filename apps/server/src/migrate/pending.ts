// SPDX-License-Identifier: AGPL-3.0-or-later
import { Client } from 'pg';
import { BootError } from '../boot/boot-error.ts';
import type { CatalogEntry } from '../catalog/check-catalog.ts';
import { readMigrationFiles } from './files.ts';

/**
 * Boot step 5 (ADR 0002): compares the migration files of every catalog module with the files that
 * northmes_meta.migration records as applied, and stops the boot with a BootError that names each
 * pending file as <module id>/<file name>. A catalog without migration files has none pending, so
 * the check opens no connection then.
 */
export async function checkPending(
  appUrl: string,
  catalog: readonly CatalogEntry[],
): Promise<void> {
  const files = catalog.flatMap(({ manifest, migrationsDir }) =>
    readMigrationFiles(migrationsDir).map((file) => `${manifest.id}/${file.name}`),
  );
  if (files.length === 0) return;
  const applied = await appliedFiles(appUrl);
  const pending = files.filter((file) => !applied.has(file));
  if (pending.length > 0) {
    throw new BootError(pending.map((file) => `${file} is not applied; run pnpm northmes migrate`));
  }
}

/** The files that northmes_meta.migration records as applied, as <module id>/<file name>. */
async function appliedFiles(url: string): Promise<Set<string>> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ module: string; name: string }>(
      'select module, name from northmes_meta.migration',
    );
    return new Set(rows.map(({ module, name }) => `${module}/${name}`));
  } finally {
    await client.end();
  }
}
