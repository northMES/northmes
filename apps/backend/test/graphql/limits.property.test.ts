// SPDX-License-Identifier: AGPL-3.0-or-later
import fc from 'fast-check';
import { buildSchema, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { operationCost } from '../../src/graphql/cost.ts';
import { graphqlLimits } from '../../src/graphql/limits.ts';
import { createGraphqlServer, GRAPHQL_PATH } from '../../src/graphql/server.ts';

// Property tests of the GraphQL request limits (plan 05, audit finding B4): fast-check generates
// request bodies and page sizes that no example-based test lists, and shrinks a failure to the
// smallest input that shows it.

const schema = buildSchema(`
  type Query {
    orders(first: Int = 25, last: Int): OrderConnection!
    me: Person
    tags: [String!]!
  }
  type OrderConnection { edges: [OrderEdge!]! totalCount: Int! }
  type OrderEdge { node: Order! }
  type Order { id: ID! operations(first: Int = 25): OperationConnection! }
  type OperationConnection { edges: [OperationEdge!]! }
  type OperationEdge { node: Operation! }
  type Operation { id: ID! }
  type Person { name: String! friend: Person }
`);

// The rate limit answers 429 once the budget is spent, which would hide every later run, so the
// budget here is unlimited. The other limits keep their production values.
const server = createGraphqlServer(schema, {
  limits: { ...graphqlLimits, rateBudget: Number.MAX_SAFE_INTEGER },
});
const url = `http://127.0.0.1${GRAPHQL_PATH}`;

/** Fragments of GraphQL syntax, so generated documents reach the parser and the limits. */
const graphqlToken = fc.constantFrom(
  '{',
  '}',
  '(',
  ')',
  ':',
  '$first',
  '...',
  'query',
  'fragment F on Query',
  'orders',
  'edges',
  'node',
  'me',
  'friend',
  'name',
  'first: 100',
  '__typename',
  '@include(if: true)',
);

const query = fc.oneof(
  fc.string(),
  fc.array(graphqlToken, { maxLength: 200 }).map((tokens) => tokens.join(' ')),
);

/** A request body: well-formed requests with generated documents and variables, or any text. */
const body = fc.oneof(
  fc
    .record({ query, variables: fc.option(fc.dictionary(fc.string(), fc.jsonValue())) })
    .map((request) => JSON.stringify(request)),
  fc.json(),
  fc.string(),
);

describe('the GraphQL request limits under generated input (B4)', () => {
  it('B4 every request body gets a client error or an answer, never a server error or a stack trace', async () => {
    await fc.assert(
      fc.asyncProperty(body, async (text) => {
        const response = await server.fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(text)),
          },
          body: text,
        });
        const answer = await response.text();

        expect(response.status).toBeLessThan(500);
        expect(answer).not.toMatch(/\bat .+\.(ts|js):\d+/);
      }),
      { numRuns: 300 },
    );
  });

  it('B4 the cost of an operation never falls when it asks for more rows', () => {
    const nested = parse(`query ($outer: Int, $inner: Int) {
      orders(first: $outer) { edges { node { id operations(first: $inner) { edges { node { id } } } } } }
    }`);
    const cost = (outer: number, inner: number) =>
      operationCost(schema, nested, {
        variables: { outer, inner },
        defaultListSize: graphqlLimits.defaultListSize,
      });
    const size = fc.integer({ min: -10, max: 1000 });

    fc.assert(
      fc.property(size, size, size, (outer, inner, more) => {
        const base = cost(outer, inner);

        expect(base).toBeGreaterThanOrEqual(1);
        expect(cost(outer + Math.max(0, more), inner)).toBeGreaterThanOrEqual(base);
        expect(cost(outer, inner + Math.max(0, more))).toBeGreaterThanOrEqual(base);
      }),
    );
  });
});
