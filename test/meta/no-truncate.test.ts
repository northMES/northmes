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

  it('E02-S02 GRANT ALL on a table counts as a TRUNCATE grant, and on a schema or a sequence does not', () => {
    const path = 'examples/plugin-validator/migrations/20261008120200_rejection.sql';

    const findings = scan([
      {
        path,
        text: [
          'grant all on example_validator.rejection to nm_app;',
          'GRANT ALL PRIVILEGES ON TABLE example_validator.rejection TO nm_app;',
          'grant all on all tables in schema example_validator to nm_app;',
          'alter default privileges in schema example_validator grant all on tables to nm_app;',
          'grant all on schema example_validator to nm_mod_example_validator;',
          'grant all on sequence example_validator.rejection_seq to nm_app;',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      { path, line: 1 },
      { path, line: 2 },
      { path, line: 3 },
      { path, line: 4 },
    ]);
  });

  it('E02-S02 a comment that names grant does not hide the TRUNCATE grant after it', () => {
    const path = 'modules/core/migrations/20261008120300_article.sql';

    const findings = scan([
      {
        path,
        text: [
          '-- grant read access on the table',
          'grant all on core.article to nm_app;',
          '/* grant the owner',
          '   on its own */',
          'grant select, truncate on core.article to nm_app;',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      { path, line: 2 },
      { path, line: 5 },
    ]);
  });

  it('E02-S02 a TRUNCATE grant inside a line or block comment is not a finding', () => {
    const findings = scan([
      {
        path: 'modules/core/migrations/20261008120400_article.sql',
        text: [
          '-- grant truncate on core.article to nm_app;',
          '/* grant all on core.article to nm_app; */',
          '/*',
          '  grant select, truncate on core.article to nm_app;',
          '*/',
          'grant select on core.article to nm_app;',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([]);
  });
});
