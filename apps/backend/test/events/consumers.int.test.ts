// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUIDv7 } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { signInAt } from '@northmes/backend/testing';
import { articleCreated } from '@northmes/core-contracts';
import { EventConsumer } from '@northmes/sdk/events';
import {
  createTestApp,
  given,
  gqlClient,
  type HostFactory,
  query,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.ts';
import { importServers, inRepoCatalog } from '../../src/boot/boot.ts';
import { scopedDatabase } from '../../src/db/scoped-database.ts';
import { consume, type EventJob } from '../../src/events/consume.ts';
import { recorded, recorder } from '../fixtures/events/recording-consumer.ts';

/** The host of hostFactory with the recorder fixture plugin after the in-repo modules. */
const withRecorder: HostFactory = async ({ modules, config }) => {
  const servers = [...(await importServers(inRepoCatalog({ modules }))), recorder];
  const app = await NestFactory.create(AppModule.forRoot(config, servers), {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  return { app, modules: servers.map(({ id }) => id) };
};

/**
 * A consumer runs after the command that published its event commits, once per event, in a
 * transaction at the event's scope (ADR 0014).
 */
describe('event consumers', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;
  let pool: Pool | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory: withRecorder, database: db });
    await testApp.app.listen(0, '127.0.0.1');
    pool = new Pool({ connectionString: db.appUrl });
    // Every pool has an error handler before use (ADR 0041). When useTestDatabase drops the
    // database with (force), Postgres ends any connection still open with 57P01, and pg-pool emits
    // that on the pool; without a listener it fails the run as an unhandled error.
    pool.on('error', () => {});
  });

  afterAll(async () => {
    await testApp?.app.close();
    await pool?.end();
  });

  beforeEach(() => {
    recorded.length = 0;
  });

  /** The ScopedDatabase of the server, on its own nm_app pool. */
  function database() {
    if (!pool) throw new Error('the pool did not start');
    return scopedDatabase(new Kysely<unknown>({ dialect: new PostgresDialect({ pool }) }));
  }

  it("E05-S09 northmes migrate installs pg-boss's schema, whose version nm_app reads", async () => {
    const [row] = await query<{ version: number }>(db.appUrl, 'select version from pgboss.version');

    expect(row?.version).toBeGreaterThan(0);
  });

  it("E05-S09 a consumer gets a core.article.created event after the command commits, once, in a transaction at the event's scope", async () => {
    if (!testApp) throw new Error('the test app did not start');
    const headers = await signInAt(testApp.app, db.ownerUrl, given.plant());
    const client = gqlClient(await testApp.app.getUrl(), { headers });
    const id = randomUUIDv7();

    await client.send(
      `mutation ($input: CoreCreateArticleInput!) { coreCreateArticle(input: $input) { id } }`,
      { input: { id, code: 'CN-100', name: 'Connector' } },
    );

    await expect
      .poll(() => recorded.filter(({ event }) => event.entity.id === id), { timeout: 10_000 })
      .toEqual([
        {
          event: {
            id: expect.any(String),
            name: 'core.article.created',
            schemaVersion: 1,
            entity: { type: 'core.article', id, version: 1 },
            scopeId: expect.any(String),
            position: expect.stringMatching(/^\d+$/),
            data: { code: 'CN-100', name: 'Connector' },
          },
          readsEvent: 1,
        },
      ]);
  });

  /** An event of `scope` as a job carries it. Its id names no row of core.event. */
  function eventAt(scope: string): EventJob {
    return {
      id: randomUUIDv7(),
      name: 'core.article.created',
      schemaVersion: 1,
      entity: { type: 'core.article', id: randomUUIDv7(), version: 1 },
      scopeId: scope,
      position: '1',
      data: { code: 'RD-1', name: 'Redelivered' },
    };
  }

  it('E05-S09 a redelivered event is processed once', async () => {
    const handled: string[] = [];
    const counting = EventConsumer(articleCreated, {
      name: 'counting',
      async handle(event) {
        handled.push(event.id);
      },
    });
    const registered = {
      module: 'recorder',
      queue: 'recorder.counting',
      consumer: counting.consumer,
    };
    const event = eventAt(given.company());

    await consume(database(), registered, event);
    await consume(database(), registered, event);

    expect(handled).toEqual([event.id]);
  });

  it('E05-S09 a consumer that throws leaves no inbox row, so the event runs again', async () => {
    let attempts = 0;
    const flaky = EventConsumer(articleCreated, {
      name: 'flaky',
      async handle() {
        attempts += 1;
        if (attempts === 1) throw new Error('the first attempt fails');
      },
    });
    const registered = { module: 'recorder', queue: 'recorder.flaky', consumer: flaky.consumer };
    const event = eventAt(given.company());

    const first = await consume(database(), registered, event).then(
      () => 'handled',
      (error: Error) => error.message,
    );
    await consume(database(), registered, event);

    expect(first).toBe('the first attempt fails');
    expect(attempts).toBe(2);
  });
});
