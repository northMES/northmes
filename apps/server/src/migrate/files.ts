// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageDirOf } from '../catalog/package-dir.ts';

/** One migration file of a module: <UTC yyyymmddHHMMss>_<slug>.sql (ADR 0006). */
export interface MigrationFile {
  /** The file name, which northmes_meta.migration records. */
  readonly name: string;
  readonly sql: string;
  /** The sha256 of the file's bytes, in hex. */
  readonly sha256: string;
}

/** The migrations folder of the package that holds a manifest, which manifestUrl names (ADR 0006). */
export function migrationsDirOf(manifestUrl: string): string {
  return join(packageDirOf(manifestUrl), 'migrations');
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

/** The first line of a migration file, which says whether it expands or contracts the schema. */
const markers = ['-- migration: expand', '-- migration: contract'];

/**
 * The problems with a module's files that refuse a migrate run before it applies any file (ADR
 * 0006): two or more files that share a timestamp prefix, the part of the name before its first
 * underscore, and a file whose first line is not its expand or contract marker (ADR 0045). Each
 * problem names its files as <module id>/<file name>.
 */
export function fileProblems(moduleId: string, files: readonly MigrationFile[]): string[] {
  const shared = [...Map.groupBy(files, (file) => file.name.split('_', 1)[0])]
    .filter(([, sharing]) => sharing.length > 1)
    .map(([prefix, sharing]) => {
      const paths = sharing.map((file) => `${moduleId}/${file.name}`);
      const listed = `${paths.slice(0, -1).join(', ')} and ${paths.at(-1)}`;
      return `${listed} share the timestamp prefix ${prefix}; give each file a timestamp of its own`;
    });
  const unmarked = files
    .filter((file) => !markers.includes(file.sql.split('\n', 1)[0]?.trimEnd() ?? ''))
    .map(
      (file) =>
        `${moduleId}/${file.name} has no expand or contract marker; start the file with "-- migration: expand" or "-- migration: contract"`,
    );
  return [...shared, ...unmarked];
}
