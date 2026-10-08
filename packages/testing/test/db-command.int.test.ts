// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { randomUUIDv7 } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { given, query, useTestDatabase } from '../src/index.ts';

const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Runs in a fresh Node process: renders the table template through the script given on the command
// line and prints the SQL.
const renderTable = `
const [url, options] = process.argv.slice(1);
const { render } = await import(url);
const { module, slug, now } = JSON.parse(options);
process.stdout.write(render({ module, slug, now: new Date(now) }).sql);
`;

/**
 * The SQL that pnpm gen:migration writes for a new table. scripts/gen-migration.mjs is AGPL, so this
 * MIT package runs it by path in a child process instead of importing it (ADR 0056).
 */
function tableSql(module: string, slug: string): string {
  const script = new URL('../../../scripts/gen-migration.mjs', import.meta.url).href;
  const options = JSON.stringify({ module, slug, now: '2026-10-08T12:00:00Z' });
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', renderTable, script, options],
    { encoding: 'utf8' },
  );

  expect(child.status, child.stderr).toBe(0);
  return child.stdout;
}

describe('given', () => {
  it('E02-S02 given.plant() returns a fresh scope id on each call', () => {
    const plants = [given.plant(), given.plant()];

    expect(plants).toEqual([expect.stringMatching(uuidv7), expect.stringMatching(uuidv7)]);
    expect(plants[0]).not.toBe(plants[1]);
  });

  it('E02-S02 given.company() returns a fresh scope id on each call', () => {
    const companies = [given.company(), given.company()];

    expect(companies).toEqual([expect.stringMatching(uuidv7), expect.stringMatching(uuidv7)]);
    expect(companies[0]).not.toBe(companies[1]);
  });
});

describe('db.command', () => {
  const db = useTestDatabase();
  // Nothing reads the principal and the reason until the audit context exists.
  const fixture = {
    principal: { type: 'system', id: randomUUIDv7() },
    reason: 'E02-S02 fixture',
  } as const;

  beforeAll(async () => {
    const sql = tableSql('db-command', 'note');
    // nm_owner stands in for the module's owner role, which migrate would create. The table's
    // owner bypasses the policies, which apply to nm_app (ADR 0008).
    await query(
      db.ownerUrl,
      `create schema db_command;
       ${sql}
       grant usage on schema db_command to nm_app;`,
    );
  });

  it('E02-S02 a row written through db.command at plant A is visible to plant A and not to plant B', async () => {
    const plantA = given.plant();
    const plantB = given.plant();
    const notesAt = (plant: string) =>
      db.command({ ...fixture, scopes: [plant] }, async (tx) => {
        const { rows } = await tx.query('select scope_id from db_command.note');
        return rows;
      });

    await db.command({ ...fixture, scopes: [plantA] }, async (tx) => {
      await tx.query('insert into db_command.note (scope_id) values ($1)', [plantA]);
    });

    expect(await notesAt(plantA)).toEqual([{ scope_id: plantA }]);
    expect(await notesAt(plantB)).toEqual([]);
  });
});
