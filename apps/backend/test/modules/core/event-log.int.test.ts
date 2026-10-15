// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { given, query, useTestDatabase } from '@northmes/testing';
import { Client } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { queryAsCore } from '../../../src/testing.ts';

/**
 * core.event is the outbox and the event log, and core.publish_events gives each committed event
 * its position, the cursor every reader pages by, and returns the events it published (ADR 0014).
 */
describe('the event log and its sequencer', () => {
  const db = useTestDatabase();
  const principal = { type: 'system', id: 'e05-s09-events' } as const;
  const clients: Client[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.end()));
  });

  const insertEvent = `insert into core.event
      (id, event, entity_type, entity_id, entity_version, scope_id, data, context)
    values ($1, 'test.thing.changed', 'test.thing', $2, 1, $3, '{}', '{}')`;

  /** Writes one event at `scope` as nm_app in a transaction that commits, and returns its id. */
  async function publish(scope: string): Promise<string> {
    const id = randomUUIDv7();
    await db.command({ principal, scopes: [scope], reason: 'E05-S09 fixture' }, (tx) =>
      tx.query(insertEvent, [id, randomUUIDv7(), scope]),
    );
    return id;
  }

  /** A connection as nm_app with an open transaction that writes and reads at `scope`. */
  async function openTransaction(scope: string): Promise<Client> {
    const client = new Client({ connectionString: db.appUrl });
    clients.push(client);
    await client.connect();
    await client.query('begin');
    await client.query(
      `select set_config('northmes.read_scopes', $1::uuid[]::text, true),
              set_config('northmes.write_scopes', $1::uuid[]::text, true)`,
      [[scope]],
    );
    return client;
  }

  /** Runs one batch of the sequencer as nm_app and returns the events it published, by id. */
  async function sequence(): Promise<Record<string, string>> {
    const rows = await query<{ id: string; position: string }>(
      db.appUrl,
      'select id, position::text from core.publish_events(500)',
    );
    return Object.fromEntries(rows.map(({ id, position }) => [id, position]));
  }

  /** The position of each event by id, read as the owner. */
  async function positions(ids: readonly string[]): Promise<Record<string, string | null>> {
    const rows = await queryAsCore<{ id: string; position: string | null }>(
      db.ownerUrl,
      'select id, position::text from core.event where id = any ($1::uuid[])',
      [ids],
    );
    return Object.fromEntries(rows.map(({ id, position }) => [id, position]));
  }

  it('E05-S09 a new event has no position until the sequencer publishes it, in insertion order', async () => {
    const scope = given.company();
    const first = await publish(scope);
    const second = await publish(scope);
    expect(await positions([first, second])).toEqual({ [first]: null, [second]: null });

    const returned = await sequence();

    const published = await positions([first, second]);
    expect(Number(published[second])).toBe(Number(published[first]) + 1);
    expect(returned).toEqual(published);
  });

  it('E05-S09 an event that commits after a later one gets the higher position, so a reader paging by position misses neither', async () => {
    const scope = given.company();
    const late = await openTransaction(scope);
    const lateId = randomUUIDv7();
    await late.query(insertEvent, [lateId, randomUUIDv7(), scope]);
    const early = await publish(scope);

    const firstBatch = await sequence();
    await late.query('commit');
    const secondBatch = await sequence();

    expect(Object.keys(firstBatch)).toEqual([early]);
    expect(Object.keys(secondBatch)).toEqual([lateId]);
    expect(Number(secondBatch[lateId])).toBeGreaterThan(Number(firstBatch[early]));
  });

  it('E05-S09 a second sequencer while one runs publishes nothing and returns no events', async () => {
    const scope = given.company();
    const id = await publish(scope);
    const running = await openTransaction(scope);
    await running.query('select * from core.publish_events(500)');

    const second = await sequence();
    await running.query('commit');

    expect(second).toEqual({});
    expect((await positions([id]))[id]).not.toBeNull();
  });

  it('E05-S09 an event written in a transaction that rolls back is never published', async () => {
    const scope = given.company();
    const rolledBack = await openTransaction(scope);
    const id = randomUUIDv7();
    await rolledBack.query(insertEvent, [id, randomUUIDv7(), scope]);
    await rolledBack.query('rollback');

    await sequence();

    expect(await positions([id])).toEqual({});
  });

  it('E05-S09 nm_app writes events only at its write scopes, reads them only at its read scopes, and never sets a position', async () => {
    const scope = given.company();
    const other = given.company();
    const id = await publish(scope);

    const outside = await db
      .command({ principal, scopes: [other], reason: 'E05-S09 probe' }, (tx) =>
        tx.query(insertEvent, [randomUUIDv7(), randomUUIDv7(), scope]),
      )
      .then(
        () => 'written',
        (error: Error) => error.message,
      );
    const readOutside = await db.command(
      { principal, scopes: [other], reason: 'E05-S09 probe' },
      async (tx) => (await tx.query('select id from core.event where id = $1', [id])).rowCount,
    );
    const readInside = await db.command(
      { principal, scopes: [scope], reason: 'E05-S09 probe' },
      async (tx) => (await tx.query('select id from core.event where id = $1', [id])).rowCount,
    );
    const setPosition = await db
      .command({ principal, scopes: [scope], reason: 'E05-S09 probe' }, (tx) =>
        tx.query('update core.event set position = 1 where id = $1', [id]),
      )
      .then(
        () => 'updated',
        (error: Error) => error.message,
      );

    expect(outside).toBe('new row violates row-level security policy for table "event"');
    expect(readOutside).toBe(0);
    expect(readInside).toBe(1);
    expect(setPosition).toBe('permission denied for table event');
  });
});
