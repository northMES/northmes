// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { type GraphqlLimits, graphqlLimits } from '../../src/graphql/limits.ts';
import { createGraphqlServer, GRAPHQL_PATH } from '../../src/graphql/server.ts';
import type { Principal } from '../../src/principal.ts';

// The rate limit of audit finding B4 (#503): each principal, or each client address for a request
// without one, spends a budget of cost per window, and an operation over it gets 429 with
// Retry-After until the window passes.

const schema = buildSchema(`
  type Query {
    orders(first: Int = 25): OrderConnection!
    version: String!
  }
  type OrderConnection { edges: [OrderEdge!]! }
  type OrderEdge { node: Order! }
  type Order { id: ID! }
`);
const query = schema.getQueryType();
const fields = query?.getFields() ?? {};
if (fields.orders) fields.orders.resolve = () => ({ edges: [] });
if (fields.version) fields.version.resolve = () => '1';

/** A small budget, so a test reaches it in a few requests: each version query costs 10. */
const limits: GraphqlLimits = {
  ...graphqlLimits,
  rateWindowMs: 60_000,
  rateBudget: 30,
  operationBaseCost: 10,
};

/** A server with `limits` whose clock the test moves, and principals from x-test-user. */
function serverAt(serverLimits: GraphqlLimits = limits) {
  const clock = { now: 1_000_000 };
  const server = createGraphqlServer(schema, {
    limits: serverLimits,
    now: () => clock.now,
    resolvePrincipal: async (headers) => {
      const userId = headers.get('x-test-user');
      return userId ? ({ userId } as Principal) : null;
    },
  });
  /** Runs `source` as `user`, or without a principal from `address`. */
  async function run(source: string, { user, address }: { user?: string; address?: string }) {
    const body = JSON.stringify({ query: source });
    const response = await server.fetch(
      `http://127.0.0.1${GRAPHQL_PATH}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(body)),
          ...(user ? { 'x-test-user': user } : {}),
        },
        body,
      },
      { req: { ip: address ?? '192.0.2.1' } },
    );
    const answer = await response.json();
    return {
      status: response.status,
      retryAfter: response.headers.get('retry-after'),
      data: answer.data,
      codes: (answer.errors ?? []).map(
        (error: { extensions?: { errorCode?: string } }) => error.extensions?.errorCode,
      ),
    };
  }
  return { clock, run };
}

describe('the rate limit of GraphQL requests (B4)', () => {
  it('B4 a principal over the limit gets 429 with Retry-After until the window passes', async () => {
    const { clock, run } = serverAt();
    for (let i = 0; i < 3; i += 1) {
      expect((await run('{ version }', { user: 'ada' })).status).toBe(200);
    }

    clock.now += 15_000;
    const over = await run('{ version }', { user: 'ada' });

    expect(over).toMatchObject({ status: 429, retryAfter: '45', data: undefined });
    expect(over.codes).toEqual(['core.rate_limited']);

    clock.now += 45_000;
    expect((await run('{ version }', { user: 'ada' })).status).toBe(200);
  });

  it('B4 another principal is not affected', async () => {
    const { run } = serverAt();
    for (let i = 0; i < 4; i += 1) await run('{ version }', { user: 'ada' });

    expect((await run('{ version }', { user: 'bob' })).status).toBe(200);
  });

  it('B4 a request without a principal counts against its client address', async () => {
    const { run } = serverAt();
    for (let i = 0; i < 3; i += 1) await run('{ version }', { address: '192.0.2.7' });

    expect((await run('{ version }', { address: '192.0.2.7' })).status).toBe(429);
    expect((await run('{ version }', { address: '192.0.2.8' })).status).toBe(200);
    expect((await run('{ version }', { user: 'ada', address: '192.0.2.7' })).status).toBe(200);
  });

  // The budget counts what #477 computes, so a list of many rows spends more than a scalar.
  it('B4 an operation spends its base cost and its cost', async () => {
    const { run } = serverAt();

    expect(
      (await run('{ orders(first: 5) { edges { node { id } } } }', { user: 'ada' })).status,
    ).toBe(200);
    expect((await run('{ version }', { user: 'ada' })).status).toBe(429);
  });

  // A screen loads a few lists a second at most; the default budget allows far more.
  it('B4 the default limit lets a busy session load a list of 100 rows every second for a minute', async () => {
    const { clock, run } = serverAt(graphqlLimits);
    for (let second = 0; second < 60; second += 1) {
      const result = await run('{ orders(first: 100) { edges { node { id } } } }', { user: 'ada' });
      expect(result.status, `second ${second}`).toBe(200);
      clock.now += 1000;
    }
  });
});
