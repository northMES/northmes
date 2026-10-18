// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import {
  givenCompany,
  givenIntegrationToken,
  hostFactory,
  queryAsCore,
} from '@northmes/backend/testing';
import { createTestApp, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, describe, expect, it } from 'vitest';
import { PostgresThrottlerStorage } from '../../src/http/public-api/public-api-rate-limit.ts';

// The rate limits of the public REST API (ADR 0073 section 6): off unless NORTHMES_API_RATE_LIMIT
// is on, then counted per credential in Postgres, NORTHMES_API_RATE_LIMIT_READS GET requests and
// NORTHMES_API_RATE_LIMIT_WRITES POST requests a minute, 600 and 60 by default. A refusal is 429
// core.request.rate_limited as a problem with Retry-After in seconds.

/** A code no other test uses. */
const code = () => `RL-${randomBytes(3).toString('hex')}`;

describe('the rate limits of the public API', () => {
  const db = useTestDatabase();
  const opened: TestApp[] = [];

  afterAll(async () => {
    await Promise.all(opened.map(({ app }) => app.close()));
  });

  /** A listening app on the file's database with these server settings. */
  async function appWith(env: Record<string, string>) {
    const testApp = await createTestApp({ modules: ['core'], hostFactory, database: db, env });
    opened.push(testApp);
    await testApp.app.listen(0, '127.0.0.1');
    return { app: testApp.app, url: await testApp.app.getUrl() };
  }

  /** The apps of the tests, each built once. */
  const apps = {
    defaults: memo(() => appWith({ NORTHMES_API_RATE_LIMIT: 'on' })),
    off: memo(() =>
      appWith({
        NORTHMES_API_RATE_LIMIT: 'off',
        NORTHMES_API_RATE_LIMIT_READS: '1',
        NORTHMES_API_RATE_LIMIT_WRITES: '1',
      }),
    ),
    configured: memo(() =>
      appWith({
        NORTHMES_API_RATE_LIMIT: 'on',
        NORTHMES_API_RATE_LIMIT_READS: '3',
        NORTHMES_API_RATE_LIMIT_WRITES: '2',
      }),
    ),
    secondProcess: memo(() =>
      appWith({
        NORTHMES_API_RATE_LIMIT: 'on',
        NORTHMES_API_RATE_LIMIT_READS: '3',
        NORTHMES_API_RATE_LIMIT_WRITES: '2',
      }),
    ),
  };

  /** A token of a new company, bound to the company, that reads and creates articles. */
  async function givenToken(app: Awaited<ReturnType<typeof appWith>>['app']) {
    const { company } = await givenCompany(db.ownerUrl, {});
    return givenIntegrationToken(app, db.ownerUrl, {
      companyId: company,
      scopeId: company,
      permissions: ['core.article:read', 'core.article:create'],
    });
  }

  /** One write: a create of a new article. */
  function write(url: string, authorization: string, id = randomUUIDv7()) {
    return fetch(`${url}/api/v1/core/commands/create-article`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ id, code: code(), name: 'Bolt' }),
    });
  }

  /** One read: the list of articles. */
  function read(url: string, authorization: string) {
    return fetch(`${url}/api/v1/core/articles`, { headers: { authorization } });
  }

  /** The statuses of the responses, each body read and dropped. */
  async function statuses(responses: Promise<Response>[] | Response[]): Promise<number[]> {
    const settled = await Promise.all(responses);
    await Promise.all(settled.map((response) => response.body?.cancel()));
    return settled.map((response) => response.status);
  }

  /** The statuses of `count` requests sent one after the other. */
  async function inSequence(count: number, send: () => Promise<Response>): Promise<number[]> {
    const answers: Response[] = [];
    for (let i = 0; i < count; i += 1) answers.push(await send());
    return statuses(answers);
  }

  it('ADR0073-W4 the 61st write in a minute from one token returns 429 core.request.rate_limited with Retry-After', async () => {
    const { app, url } = await apps.defaults();
    const { authorization } = await givenToken(app);

    const first = await inSequence(60, () => write(url, authorization));
    const id = randomUUIDv7();
    const over = await write(url, authorization, id);
    const body = (await over.json()) as Record<string, unknown>;
    const afterwards = await fetch(`${url}/api/v1/core/articles?first=100`, {
      headers: { authorization },
    });
    const listed = (await afterwards.json()) as { nodes: { id: string }[] };

    expect(first.every((status) => status === 201)).toBe(true);
    expect(over.status).toBe(429);
    expect(over.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const retryAfter = Number(over.headers.get('retry-after'));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(body).toMatchObject({
      status: 429,
      title: 'Too many requests',
      code: 'core.request.rate_limited',
      details: { retryAfterSeconds: retryAfter },
      instance: '/api/v1/core/commands/create-article',
    });
    // The refused write ran no command, and reads keep their own count.
    expect(afterwards.status).toBe(200);
    expect(listed.nodes.map((node) => node.id)).not.toContain(id);
    expect(listed.nodes).toHaveLength(60);
    // Sixty-two requests in sequence take longer than the default 5 seconds while the whole suite runs.
  }, 30_000);

  it('ADR0073-W4 with the rate limit off, no request is refused, whatever the limits say', async () => {
    const { app, url } = await apps.off();
    const { authorization } = await givenToken(app);

    const writes = await inSequence(3, () => write(url, authorization));
    const reads = await inSequence(3, () => read(url, authorization));

    expect(writes).toEqual([201, 201, 201]);
    expect(reads).toEqual([200, 200, 200]);
  });

  it('ADR0073-W4 a configured limit is used instead of the default', async () => {
    const { app, url } = await apps.configured();
    const { authorization } = await givenToken(app);

    expect(await inSequence(3, () => write(url, authorization))).toEqual([201, 201, 429]);
    expect(await inSequence(4, () => read(url, authorization))).toEqual([200, 200, 200, 429]);
  });

  it('ADR0073-W4 reads and writes have separate limits', async () => {
    const { app, url } = await apps.configured();
    const { authorization } = await givenToken(app);

    const writes = await inSequence(3, () => write(url, authorization));
    const reads = await inSequence(3, () => read(url, authorization));

    expect(writes).toEqual([201, 201, 429]);
    expect(reads).toEqual([200, 200, 200]);
  });

  it('ADR0073-W4 two tokens have separate counts', async () => {
    const { app, url } = await apps.configured();
    const first = await givenToken(app);
    const second = await givenToken(app);

    const fromFirst = await inSequence(3, () => write(url, first.authorization));
    const fromSecond = await inSequence(2, () => write(url, second.authorization));

    expect(fromFirst).toEqual([201, 201, 429]);
    expect(fromSecond).toEqual([201, 201]);
  });

  it('ADR0073-W4 two backend processes on one database share the count of a token', async () => {
    const one = await apps.configured();
    const other = await apps.secondProcess();
    const { authorization } = await givenToken(one.app);

    const answers = await statuses([
      await write(one.url, authorization),
      await write(other.url, authorization),
      await write(one.url, authorization),
      await write(other.url, authorization),
    ]);

    expect(answers).toEqual([201, 201, 429, 429]);
  });

  it('ADR0073-W4 a token writes again once its window has passed, and the cleanup removes rows whose window and block have passed', async () => {
    const { app, url } = await apps.configured();
    const { id, authorization } = await givenToken(app);
    expect(await inSequence(3, () => write(url, authorization))).toEqual([201, 201, 429]);
    const kept = await givenToken(app);
    expect(await statuses([await write(url, kept.authorization)])).toEqual([201]);

    await queryAsCore(
      db.ownerUrl,
      `update core.rate_limit
          set window_ends_at = now() - interval '1 second',
              blocked_until = case when blocked_until is null then null
                                   else now() - interval '1 second' end
        where subject = $1`,
      [id],
    );
    await app.get(PostgresThrottlerStorage).prune();
    const subjects = await queryAsCore<{ subject: string }>(
      db.ownerUrl,
      'select subject from core.rate_limit where subject = any($1)',
      [[id, kept.id]],
    );

    expect(subjects.map(({ subject }) => subject)).toEqual([kept.id]);
    expect(await statuses([await write(url, authorization)])).toEqual([201]);
  });

  it('ADR0073-W4 nm_app reaches core.rate_limit only through its definer functions, which pin their search_path', async () => {
    const asApp = (statement: string) =>
      db.command(
        { principal: { type: 'user', id: 'adr0073-w4' }, scopes: [], reason: 'probe' },
        (tx) => tx.query(statement),
      );

    await expect(asApp('select * from core.rate_limit')).rejects.toMatchObject({ code: '42501' });
    await expect(
      asApp(
        `insert into core.rate_limit (subject, throttler, hits, window_ends_at)
         values ('k', 'writes', 0, now())`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
    const functions = await queryAsCore<{ name: string; prosecdef: boolean; proconfig: string[] }>(
      db.ownerUrl,
      `select proname as name, prosecdef, proconfig from pg_proc
        where pronamespace = 'core'::regnamespace and proname like 'rate_limit%'
        order by proname`,
    );
    const [table] = await queryAsCore<{ relrowsecurity: boolean }>(
      db.ownerUrl,
      `select relrowsecurity from pg_class where oid = 'core.rate_limit'::regclass`,
    );

    expect(functions).toEqual([
      { name: 'rate_limit_hit', prosecdef: true, proconfig: ['search_path=pg_catalog, pg_temp'] },
      { name: 'rate_limit_prune', prosecdef: true, proconfig: ['search_path=pg_catalog, pg_temp'] },
    ]);
    expect(table).toEqual({ relrowsecurity: true });
  });
});

/** fn's promise, made on the first call and shared by every later one. */
function memo<Result>(fn: () => Promise<Result>): () => Promise<Result> {
  let made: Promise<Result> | undefined;
  return () => {
    made ??= fn();
    return made;
  };
}
