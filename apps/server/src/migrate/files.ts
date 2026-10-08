// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One migration file of a module: <UTC yyyymmddHHMMss>_<slug>.sql (ADR 0006). */
export interface MigrationFile {
  /** The file name, which northmes_meta.migration records. */
  readonly name: string;
  readonly sql: string;
  /** The sha256 of the file's bytes, in hex. */
  readonly sha256: string;
}

/**
 * The migrations folder of the package that holds a manifest, which manifestUrl names (ADR 0006).
 * The manifest is the package's source file or its build in dist/, so the folder is found next to
 * the package.json above it.
 */
export function migrationsDirOf(manifestUrl: string): string {
  let dir = dirname(fileURLToPath(manifestUrl));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No package.json above the manifest ${manifestUrl}`);
    dir = parent;
  }
  return join(dir, 'migrations');
}

/**
 * Reads the .sql files of a module's migrations folder in lexical order of their names. The names
 * start with a UTC timestamp, so that order is the order they were written in. A module without
 * the folder has no files.
 */
export function readMigrationFiles(dir: string | undefined): MigrationFile[] {
  if (dir === undefined || !existsSync(dir)) return [];
  const names = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  return names.map((name) => {
    const bytes = readFileSync(join(dir, name));
    return {
      name,
      sql: bytes.toString('utf8'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
}
