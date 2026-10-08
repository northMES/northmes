// SPDX-License-Identifier: AGPL-3.0-or-later
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/no-truncate.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** Every .sql file under a migrations folder in the repository, outside docs/ and build output. */
function migrationFiles(): { path: string; text: string }[] {
  return globSync('**/migrations/**/*.sql', {
    cwd: root,
    exclude: ['**/node_modules', '**/dist', 'docs'],
  })
    .sort()
    .map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));
}

describe('no-truncate', () => {
  it('E02-S02 no migration grants TRUNCATE to nm_app', () => {
    expect(scan(migrationFiles())).toEqual([]);
  });

  it('E02-S02 a fixture migration that grants TRUNCATE to nm_app fails the lint naming the file', () => {
    const findings = scan([
      {
        path: 'modules/core/migrations/20261008120000_article.sql',
        text: 'create table core.article (id uuid primary key);\ngrant select, insert, update, delete on core.article to nm_app;\n',
      },
      {
        path: 'modules/planning/migrations/20261008120100_production_order.sql',
        text: 'create table planning.production_order (id uuid primary key);\n\ngrant select, insert, update, delete, truncate\n  on planning.production_order to nm_app;\n',
      },
    ]);

    expect(findings).toEqual([
      { path: 'modules/planning/migrations/20261008120100_production_order.sql', line: 3 },
    ]);
  });
});
