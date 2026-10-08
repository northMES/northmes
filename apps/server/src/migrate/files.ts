// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One migration file of a module: <UTC yyyymmddHHMMss>_<slug>.sql (ADR 0006). */
export interface MigrationFile {
  /** The file name, which northmes_meta.migration records. */
  readonly name: string;
  readonly sql: string;
  /** The sha256 of the file's bytes, in hex. */
  readonly sha256: string;
}

/**
 * Reads the .sql files of a module's migrations folder in lexical order of their names. The names
 * start with a UTC timestamp, so that order is the order they were written in.
 */
export function readMigrationFiles(dir: string | undefined): MigrationFile[] {
  if (dir === undefined) return [];
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
