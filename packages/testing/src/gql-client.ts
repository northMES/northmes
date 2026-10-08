// SPDX-License-Identifier: MIT
import type { GraphQLFormattedError } from 'graphql';
import { createClient } from 'graphql-ws';

/** What /graphql answered: the HTTP status, and the GraphQL result when the body is JSON. */
export interface GqlAnswer<TData = Record<string, unknown>> {
  readonly status: number;
  readonly data?: TData | null;
  readonly errors?: readonly GraphQLFormattedError[];
}

/** The GraphQL result of one subscription event. */
export type GqlEvent<TData = Record<string, unknown>> = Omit<GqlAnswer<TData>, 'status'>;

/** How a subscription reaches /graphql: graphql-ws on its upgrade, or SSE. */
export type SubscriptionTransport = 'graphql-ws' | 'sse';

export interface SubscribeOptions {
  readonly transport: SubscriptionTransport;
}

export interface GqlClient {
  /** Sends one operation as a JSON POST to /graphql. */
  send<TData = Record<string, unknown>>(
    document: string,
    variables?: Readonly<Record<string, unknown>>,
  ): Promise<GqlAnswer<TData>>;
  /**
   * Starts a subscription and yields its events in order. Calling return() on the generator ends
   * the subscription and closes its connection.
   */
  subscribe<TData = Record<string, unknown>>(
    document: string,
    variables: Readonly<Record<string, unknown>> | undefined,
    options: SubscribeOptions,
  ): AsyncGenerator<GqlEvent<TData>, void, undefined>;
}

export interface GqlClientOptions {
  /**
   * Headers sent with every operation, such as x-northmes-plant, which names the request's plant
   * until sign-in arrives (E05). A graphql-ws subscription sends them with its handshake, and an
   * SSE subscription with its request.
   */
  readonly headers?: Readonly<Record<string, string>>;
}

/** A GraphQL client for the server at `url`, the origin that app.getUrl() returns. */
export function gqlClient(url: string, { headers = {} }: GqlClientOptions = {}): GqlClient {
  const endpoint = new URL('/graphql', url);
  return {
    async send<TData>(document: string, variables?: Readonly<Record<string, unknown>>) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          accept: 'application/graphql-response+json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query: document, variables }),
      });
      const answer: GqlAnswer<TData> = { status: response.status };
      if (!response.headers.get('content-type')?.includes('json')) return answer;
      const { data, errors } = (await response.json()) as Omit<GqlAnswer<TData>, 'status'>;
      return { ...answer, data, errors };
    },
    subscribe<TData>(
      document: string,
      variables: Readonly<Record<string, unknown>> | undefined,
      { transport }: SubscribeOptions,
    ) {
      const events = subscribers[transport]({ endpoint, headers, query: document, variables });
      return events as AsyncGenerator<GqlEvent<TData>, void, undefined>;
    },
  };
}

/** One subscription as a transport sends it to /graphql. */
interface SubscriptionRequest {
  readonly endpoint: URL;
  readonly headers: Readonly<Record<string, string>>;
  readonly query: string;
  readonly variables: Readonly<Record<string, unknown>> | undefined;
}

/** Starts one subscription over a transport and yields its events. */
type Subscriber = (request: SubscriptionRequest) => AsyncGenerator<GqlEvent, void, undefined>;

/** One subscription on its own graphql-ws connection, which it closes when it ends. */
async function* overGraphqlWs({
  endpoint,
  headers,
  query,
  variables,
}: SubscriptionRequest): AsyncGenerator<GqlEvent, void, undefined> {
  const url = new URL(endpoint);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const client = createClient({
    url: url.href,
    webSocketImpl: webSocketWith(headers),
    retryAttempts: 0,
  });
  try {
    yield* client.iterate({ query, variables: { ...variables } });
  } catch (error) {
    throw connectionError(url, error);
  } finally {
    await client.dispose();
  }
}

/**
 * graphql-ws rejects with the socket's close or error event when the connection fails, which
 * reads badly in a test failure. This turns such an event into an Error that says what happened.
 */
function connectionError(url: URL, error: unknown): unknown {
  if (error instanceof Error) return error;
  const { code, reason } = error as { code?: number; reason?: string };
  const message = code
    ? `graphql-ws on ${url.href} closed with code ${code}${reason ? `: ${reason}` : ''}`
    : `graphql-ws could not connect to ${url.href}`;
  return new Error(message, { cause: error });
}

/**
 * Node's WebSocket, which also takes an init object with handshake headers. The DOM types that
 * TypeScript loads by default know only the protocols argument.
 */
const NodeWebSocket = WebSocket as unknown as new (
  url: string | URL,
  init: { protocols?: string | string[]; headers: Readonly<Record<string, string>> },
) => WebSocket;

/** Node's WebSocket, sending `headers` with its handshake. */
function webSocketWith(headers: Readonly<Record<string, string>>): typeof WebSocket {
  return class extends NodeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, { protocols, headers });
    }
  } as typeof WebSocket;
}

/**
 * One subscription as a POST to /graphql that accepts text/event-stream, in the distinct
 * connections mode of GraphQL over SSE. Ending the subscription cancels the response body, which
 * closes the connection.
 */
async function* overSse({
  endpoint,
  headers,
  query,
  variables,
}: SubscriptionRequest): AsyncGenerator<GqlEvent, void, undefined> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { ...headers, accept: 'text/event-stream', 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`SSE on ${endpoint.href} answered ${response.status}`);
  }
  for await (const { event, data } of sseMessages(response.body)) {
    if (event === 'complete') return;
    yield JSON.parse(data) as GqlEvent;
  }
}

/** The messages of an event stream, without its comments. */
async function* sseMessages(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }, void, undefined> {
  const decoder = new TextDecoder();
  let buffered = '';
  for await (const chunk of body) {
    buffered = (buffered + decoder.decode(chunk, { stream: true })).replaceAll('\r\n', '\n');
    const blocks = buffered.split('\n\n');
    buffered = blocks.pop() ?? '';
    for (const block of blocks) {
      const fields = block.split('\n').filter((line) => line && !line.startsWith(':'));
      if (fields.length === 0) continue;
      const value = (name: string) =>
        fields
          .filter((line) => line.startsWith(`${name}:`))
          .map((line) => line.slice(name.length + 1).trimStart())
          .join('\n');
      yield { event: value('event') || 'message', data: value('data') };
    }
  }
}

const subscribers: Record<SubscriptionTransport, Subscriber> = {
  'graphql-ws': overGraphqlWs,
  sse: overSse,
};
