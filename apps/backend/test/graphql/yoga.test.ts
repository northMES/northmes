// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Logger } from '@nestjs/common';
import type { RequestContext } from '@northmes/sdk/graphql';
import { given } from '@northmes/testing';
import { GraphQLInt, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
import { createGraphqlServer, GRAPHQL_PATH } from '../../src/graphql/server.ts';
import { currentPrincipal, PLANT_HEADER, type Principal } from '../../src/principal.ts';

/**
 * Stands in for core's PrincipalResolver: a request that names a plant acts as a principal at that
 * plant, and any other request has none.
 */
async function principalOfPlant(headers: Headers): Promise<Principal | null> {
  const plantId = headers.get(PLANT_HEADER);
  if (!plantId) return null;
  return {
    userId: '019a0000-0000-7000-8000-0000000000e1',
    plantId,
    readScopes: [plantId],
    writeScopes: [plantId],
    scopes: new Map(),
  };
}

/** The plant of the principal a resolver runs as, read after an await as a database call would. */
async function plantOfPrincipal(): Promise<string | null> {
  await Promise.resolve();
  return currentPrincipal()?.plantId ?? null;
}

/** How many loaders the context held when the field resolved. The field then adds one. */
function loadersSeen(_source: unknown, _args: unknown, context: RequestContext): number {
  const seen = context.loaders.size;
  context.loaders.set('probe.thing', {});
  return seen;
}

/** Two events, each of them resolved by `resolve`. */
async function* twoEvents(): AsyncGenerator<number> {
  yield 1;
  yield 2;
}

/** The text of the error the broken fields throw, which no client may read. */
const BROKEN_TEXT = 'connection to postgres://nm_app:secret@db failed';

/** Throws as a database driver would, with the connection string in the message. */
function broken(): never {
  throw new Error(BROKEN_TEXT);
}

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      probePlant: { type: GraphQLString, resolve: plantOfPrincipal },
      probeLoaders: { type: GraphQLInt, resolve: loadersSeen },
      probeBroken: { type: GraphQLString, resolve: broken },
    },
  }),
  subscription: new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      probePlants: { type: GraphQLString, subscribe: twoEvents, resolve: plantOfPrincipal },
      probeEventLoaders: { type: GraphQLInt, subscribe: twoEvents, resolve: loadersSeen },
      probeBrokenEvents: { type: GraphQLString, subscribe: twoEvents, resolve: broken },
    },
  }),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The extensions of a masked error. */
const maskedExtensions = {
  code: 'INTERNAL_SERVER_ERROR',
  errorCode: 'core.internal',
  correlationId: expect.stringMatching(UUID),
};

interface ErrorAnswer {
  errors?: { extensions?: Record<string, unknown> }[];
}

/** The correlation id of an answer's first error. */
function correlationIdOf(answer: ErrorAnswer): unknown {
  return answer.errors?.[0]?.extensions?.correlationId;
}

/** Sends one operation to the server, with the plant header when plantId is given. */
function send(query: string, { plantId, sse = false }: { plantId?: string; sse?: boolean } = {}) {
  return createGraphqlServer(schema, { resolvePrincipal: principalOfPlant }).fetch(
    `http://127.0.0.1${GRAPHQL_PATH}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(sse ? { accept: 'text/event-stream' } : {}),
        ...(plantId ? { [PLANT_HEADER]: plantId } : {}),
      },
      body: JSON.stringify({ query }),
    },
  );
}

/** The data of every next event in an SSE answer. */
async function eventData(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return [...text.matchAll(/^event: next\ndata: (.*)$/gm)].map(([, data]) => {
    return (JSON.parse(data ?? '{}') as { data: unknown }).data;
  });
}

describe('the GraphQL server', () => {
  it('E02-S04 a query runs as the principal that the resolver resolves for its request', async () => {
    const plantId = given.plant();

    const response = await send('{ probePlant }', { plantId });

    expect(await response.json()).toEqual({ data: { probePlant: plantId } });
  });

  it('E02-S04 a request the resolver resolves no principal for runs as no principal', async () => {
    const response = await send('{ probePlant }');

    expect(await response.json()).toEqual({ data: { probePlant: null } });
  });

  it('E02-S04 each event of a subscription over SSE runs as the principal of its request', async () => {
    const plantId = given.plant();

    const response = await send('subscription { probePlants }', { plantId, sse: true });

    expect(await eventData(response)).toEqual([{ probePlants: plantId }, { probePlants: plantId }]);
  });

  it('E02-S03 every request starts with no loaders', async () => {
    const first = await send('{ probeLoaders }');
    const second = await send('{ probeLoaders }');

    expect(await first.json()).toEqual({ data: { probeLoaders: 0 } });
    expect(await second.json()).toEqual({ data: { probeLoaders: 0 } });
  });

  it('E02-S03 every event of a subscription starts with no loaders', async () => {
    const response = await send('subscription { probeEventLoaders }', { sse: true });

    expect(await eventData(response)).toEqual([{ probeEventLoaders: 0 }, { probeEventLoaders: 0 }]);
  });

  it('E02-S03 an unexpected error reaches the client masked as core.internal with a correlation id, which the one server log line names with the stack, its URL password replaced, and without its text', async () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    try {
      const response = await send('{ probeBroken }');

      const body = await response.text();
      const answer = JSON.parse(body) as ErrorAnswer;
      expect(answer).toEqual({
        data: { probeBroken: null },
        errors: [
          {
            message: 'Unexpected error.',
            path: ['probeBroken'],
            locations: [{ line: 1, column: 3 }],
            extensions: expect.objectContaining(maskedExtensions),
          },
        ],
      });
      expect(body).not.toContain('secret');
      expect(logged).toHaveBeenCalledTimes(1);
      expect(logged).toHaveBeenCalledWith(
        `A GraphQL operation failed with correlation id ${correlationIdOf(answer)}`,
        expect.stringContaining('connection to postgres://nm_app:***@db failed\n    at broken'),
      );
      expect(logged.mock.calls[0]?.[1]).not.toContain('secret');
    } finally {
      logged.mockRestore();
    }
  });

  it('E02-S03 with NODE_ENV development a masked error still carries neither its text nor originalError', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    try {
      const response = await send('{ probeBroken }');

      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({
        errors: [{ message: 'Unexpected error.', extensions: maskedExtensions }],
      });
      expect(body).not.toContain('originalError');
      expect(body).not.toContain('secret');
    } finally {
      logged.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it('E02-S03 an event of a subscription that fails reaches the client over SSE masked with a correlation id of its own, which the server log names, and without its text', async () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    try {
      const response = await send('subscription { probeBrokenEvents }', { sse: true });

      const text = await response.text();
      const events = [...text.matchAll(/^event: next\ndata: (.*)$/gm)].map(
        ([, data]) => JSON.parse(data ?? '{}') as ErrorAnswer,
      );
      expect(events).toEqual([
        {
          data: { probeBrokenEvents: null },
          errors: [
            {
              message: 'Unexpected error.',
              path: ['probeBrokenEvents'],
              locations: [{ line: 1, column: 16 }],
              extensions: maskedExtensions,
            },
          ],
        },
        {
          data: { probeBrokenEvents: null },
          errors: [
            {
              message: 'Unexpected error.',
              path: ['probeBrokenEvents'],
              locations: [{ line: 1, column: 16 }],
              extensions: maskedExtensions,
            },
          ],
        },
      ]);
      expect(text).not.toContain('secret');
      const ids = events.map(correlationIdOf);
      expect(ids[0]).not.toBe(ids[1]);
      for (const id of ids) {
        expect(logged).toHaveBeenCalledWith(
          `A GraphQL operation failed with correlation id ${id}`,
          expect.stringContaining('connection to postgres://nm_app:***@db failed'),
        );
      }
    } finally {
      logged.mockRestore();
    }
  });
});
