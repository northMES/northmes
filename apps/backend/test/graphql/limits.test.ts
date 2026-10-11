// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildSchema, type GraphQLObjectType } from 'graphql';
import { describe, expect, it } from 'vitest';
import { graphqlLimits } from '../../src/graphql/limits.ts';
import { createGraphqlServer, GRAPHQL_PATH } from '../../src/graphql/server.ts';

// The document limits of plan 05 and audit finding B4 (#477): every request is refused with a
// client error before it parses, validates or runs anything that is too big for the server.

const schema = buildSchema(`
  type Query {
    orders(first: Int = 25, last: Int): OrderConnection!
    me: Person
    tags: [String!]!
  }
  type OrderConnection { edges: [OrderEdge!]! totalCount: Int! pageInfo: PageInfo! }
  type OrderEdge { node: Order! }
  type Order { id: ID! number: String! operations(first: Int = 25): OperationConnection! }
  type OperationConnection { edges: [OperationEdge!]! }
  type OperationEdge { node: Operation! }
  type Operation { id: ID! }
  type PageInfo { hasNextPage: Boolean! }
  type Person { name: String! friend: Person }
`);

/** How many times a root field ran, so a test can tell that a refused operation ran nothing. */
const runs = { orders: 0 };
const query = schema.getQueryType() as GraphQLObjectType;
const fields = query.getFields();
if (fields.orders) {
  fields.orders.resolve = () => {
    runs.orders += 1;
    return { edges: [], totalCount: 0, pageInfo: { hasNextPage: false } };
  };
}
if (fields.me) fields.me.resolve = () => ({ name: 'Ada', friend: null });
if (fields.tags) fields.tags.resolve = () => [];

const server = createGraphqlServer(schema);
const url = `http://127.0.0.1${GRAPHQL_PATH}`;

/** Posts `body` with `contentType` and returns the status and the parsed answer. */
async function post(body: string, contentType = 'application/json') {
  const response = await server.fetch(url, {
    method: 'POST',
    headers: { 'content-type': contentType, 'content-length': String(Buffer.byteLength(body)) },
    body,
  });
  const text = await response.text();
  return { status: response.status, answer: text ? JSON.parse(text) : undefined };
}

/** Runs one operation as JSON and returns the answer's data and error messages. */
async function run(source: string, variables?: Record<string, unknown>) {
  const { status, answer } = await post(JSON.stringify({ query: source, variables }));
  return {
    status,
    data: answer?.data,
    messages: (answer?.errors ?? []).map((error: { message: string }) => error.message),
  };
}

/** `{ me { friend { friend { ... { name } } } } }` with `levels` nested friend fields. */
function friendsDeep(levels: number): string {
  return `{ me { ${'friend { '.repeat(levels)}name${' }'.repeat(levels)} } }`;
}

describe('the limits of a GraphQL request (B4)', () => {
  it('B4 a query deeper than the depth limit is refused, and one at the limit runs', async () => {
    // me is depth 1 and each friend adds one, so name sits one deeper than the last friend.
    const atLimit = await run(friendsDeep(graphqlLimits.maxDepth - 2));
    const tooDeep = await run(friendsDeep(graphqlLimits.maxDepth - 1));

    expect(atLimit.messages).toEqual([]);
    expect(atLimit.data).toEqual({ me: { friend: null } });
    expect(tooDeep.data).toBeUndefined();
    expect(tooDeep.messages.join()).toMatch(/depth limit of 12/);
  });

  it('B4 a query with more aliases than the limit is refused', async () => {
    const aliases = (count: number) =>
      `{ ${Array.from({ length: count }, (_, i) => `a${i}: me { name }`).join(' ')} }`;

    expect((await run(aliases(graphqlLimits.maxAliases))).messages).toEqual([]);
    const refused = await run(aliases(graphqlLimits.maxAliases + 1));
    expect(refused.data).toBeUndefined();
    expect(refused.messages.join()).toMatch(/aliases limit of 15/i);
  });

  it('B4 a document with more tokens than the limit is refused before it is parsed', async () => {
    const tokens = `{ tags ${'__typename '.repeat(graphqlLimits.maxTokens)}}`;

    const refused = await run(tokens);

    expect(refused.data).toBeUndefined();
    expect(refused.messages.join()).toMatch(/token limit of 2000/i);
  });

  it('B4 an operation that costs more than the limit is refused before any field runs', async () => {
    // 1 for the connection, then 100 edges of an edge, an order, a connection and 100 operations
    // of an edge and an operation: 1 + 100 × (3 + 100 × 2) = 20 301, over 20 000.
    const nested = `query ($first: Int) {
      orders(first: $first) { edges { node { id operations(first: 100) { edges { node { id } } } } } }
    }`;
    const before = runs.orders;

    const refused = await run(nested, { first: 100 });
    const allowed = await run(nested, { first: 98 });

    expect(refused.data).toBeUndefined();
    expect(refused.messages).toEqual([
      'The operation costs 20301, more than the limit of 20000. Ask for fewer rows with first, or fewer nested lists.',
    ]);
    expect(allowed.messages).toEqual([]);
    expect(runs.orders - before).toBe(1);
  });

  it("B4 a list without first costs the schema's default page size", async () => {
    // 1 + 25 × (3 + 25 × 2) = 1 326: allowed. 81 aliases are refused by the alias limit, so the
    // default is checked through the cost of one connection instead.
    const answer = await run(
      '{ orders { edges { node { id operations { edges { node { id } } } } } } }',
    );

    expect(answer.messages).toEqual([]);
  });

  it('B4 a body over the cap is refused before parsing, for each content type', async () => {
    const big = 'x'.repeat(graphqlLimits.maxBodyBytes + 1);
    const contentTypes = [
      'application/json',
      'application/graphql+json',
      'application/graphql',
      'text/plain',
    ];
    const before = runs.orders;

    for (const contentType of contentTypes) {
      const { status } = await post(`{ orders { totalCount } } # ${big}`, contentType);
      expect(status, contentType).toBe(413);
    }
    expect(runs.orders).toBe(before);
  });

  it('B4 a body without a length is refused', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"query":"{ tags }"}'));
        controller.close();
      },
    });

    const response = await server.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duplex: 'half',
    } as RequestInit);

    expect(response.status).toBe(411);
  });

  it('B4 multipart requests are refused', async () => {
    const form = new FormData();
    form.set('operations', JSON.stringify({ query: '{ orders { totalCount } }' }));
    form.set('map', '{}');
    const request = new Request(url, { method: 'POST', body: form });
    const length = (await request.clone().arrayBuffer()).byteLength;
    const before = runs.orders;

    const response = await server.fetch(url, {
      method: 'POST',
      headers: {
        'content-type': request.headers.get('content-type') ?? '',
        'content-length': String(length),
      },
      body: await request.arrayBuffer(),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(runs.orders).toBe(before);
  });
});
