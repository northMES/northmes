// SPDX-License-Identifier: AGPL-3.0-or-later
import { Client } from 'pg';
import { BootError } from '../boot/boot-error.ts';
import type { CatalogEntry } from '../catalog/check-catalog.ts';
import { readMigrationFiles } from './files.ts';

/**
 * What boot step 5 does with pending files: 'serve' refuses to start, and 'migrate' lists them for
 * pnpm northmes migrate to apply (ADR 0002, ADR 0006).
 */
export type MigrationCheckMode = 'serve' | 'migrate';

export interface CheckPendingOptions {
  readonly mode: MigrationCheckMode;
}

/**
 * Boot step 5 (ADR 0002): compares the migration files of every catalog module with the files that
 * northmes_meta.migration records as applied, and returns the pending ones as
 * <module id>/<file name>, in catalog order. In mode 'serve' a pending file stops the boot instead,
 * with a BootError that names each one. A database that migrate never ran on has every file
 * pending. A catalog without migration files has none pending, so the check opens no connection
 * then.
 *
 * The server passes a login as nm_app in `url`. pnpm northmes migrate holds no nm_app password
 * (ADR 0060), so it passes nm_owner's.
 */
export async function checkPending(
  url: string,
  catalog: readonly CatalogEntry[],
  { mode }: CheckPendingOptions,
): Promise<string[]> {
  const files = catalog.flatMap(({ manifest, migrationsDir }) =>
    readMigrationFiles(migrationsDir).map((file) => `${manifest.id}/${file.name}`),
  );
  if (files.length === 0) return [];
  const applied = await appliedFiles(url);
  const pending = files.filter((file) => !applied.has(file));
  if (mode === 'serve' && pending.length > 0) {
    throw new BootError(pending.map((file) => `${file} is not applied; run pnpm northmes migrate`));
  }
  return pending;
}

/**
 * The files that northmes_meta.migration records as applied, as <module id>/<file name>. Before
 * the first migrate run the table does not exist, and no file is applied.
 */
async function appliedFiles(url: string): Promise<Set<string>> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows: tables } = await client.query<{ present: boolean }>(
      "select to_regclass('northmes_meta.migration') is not null as present",
    );
    if (!tables[0]?.present) return new Set();
    const { rows } = await client.query<{ module: string; name: string }>(
      'select module, name from northmes_meta.migration',
    );
    return new Set(rows.map(({ module, name }) => `${module}/${name}`));
  } finally {
    await client.end();
  }
}
