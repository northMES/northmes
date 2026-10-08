// SPDX-License-Identifier: MIT
import { randomUUIDv7 } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { render } from '../../../scripts/gen-migration.mjs';
import { given, query, useTestDatabase } from '../src/index.ts';

const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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
    const { sql } = render({
      module: 'db-command',
      slug: 'note',
      now: new Date('2026-10-08T12:00:00Z'),
    });
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
