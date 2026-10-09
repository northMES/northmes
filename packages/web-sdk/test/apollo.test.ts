// SPDX-License-Identifier: MIT
import { gql } from '@apollo/client';
import { createNorthmesClient } from '@northmes/web-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

function graphqlResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    headers: { 'content-type': 'application/graphql-response+json' },
  });
}

/** A WebSocket class that records each socket it opens and what the client sends on it. */
function mockWebSocket() {
  const sockets: MockSocket[] = [];

  class MockSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readyState = MockSocket.CONNECTING;
    readonly sent: string[] = [];
    onopen: (() => void) | null = null;
    onclose: ((event: { code: number; reason: string }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;

    constructor(readonly url: string) {
      sockets.push(this);
    }

    send(data: string): void {
      this.sent.push(data);
    }

    close(): void {
      this.readyState = MockSocket.CLOSED;
    }

    /** Opens the socket as a server accepting the upgrade would. */
    open(): void {
      this.readyState = MockSocket.OPEN;
      this.onopen?.();
    }
  }

  return { WebSocket: MockSocket, sockets };
}

const boardChanged = gql`
  subscription BoardChanged {
    planningBoardChanged(plantId: "plant-a") {
      ids
    }
  }
`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createNorthmesClient', () => {
  it('E02-S05 createNorthmesClient sends the plant in x-northmes-plant over HTTP', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => graphqlResponse({ ping: 'pong' }));
    const client = createNorthmesClient({ plantId: 'plant-a', fetch });

    await client.query({ query: gql`query Ping { ping }` });

    expect(fetch).toHaveBeenCalledOnce();
    const init = fetch.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('x-northmes-plant')).toBe('plant-a');
  });

  it('E02-S05 the graphql-ws client sends empty connectionParams', async () => {
    vi.stubGlobal('location', new URL('https://northmes.test/plant-a/planning/board'));
    const { WebSocket, sockets } = mockWebSocket();
    const client = createNorthmesClient({ plantId: 'plant-a', webSocketImpl: WebSocket });

    const subscription = client.subscribe({ query: boardChanged }).subscribe(() => {});
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    const socket = sockets[0];
    socket?.open();

    // graphql-ws leaves the payload out of connection_init when connectionParams give nothing.
    await vi.waitFor(() => expect(socket?.sent).toHaveLength(1));
    expect(JSON.parse(socket?.sent[0] ?? '')).toEqual({ type: 'connection_init' });
    subscription.unsubscribe();
  });

  it("E02-S05 the graphql-ws client connects to /graphql on the page's host, over wss on an https page", async () => {
    vi.stubGlobal('location', new URL('https://northmes.test:8443/plant-a/planning/board'));
    const { WebSocket, sockets } = mockWebSocket();
    const client = createNorthmesClient({ plantId: 'plant-a', webSocketImpl: WebSocket });

    const subscription = client.subscribe({ query: boardChanged }).subscribe(() => {});
    await vi.waitFor(() => expect(sockets).toHaveLength(1));

    expect(sockets[0]?.url).toBe('wss://northmes.test:8443/graphql');
    subscription.unsubscribe();
  });

  it("E02-S05 with an apiUrl, the client sends HTTP and graphql-ws requests to that API's /graphql", async () => {
    // A static host serves the web on one origin, and config.json names the API on another.
    vi.stubGlobal('location', new URL('https://web.northmes.test/plant-a/planning/board'));
    const fetch = vi.fn<typeof globalThis.fetch>(async () => graphqlResponse({ ping: 'pong' }));
    const { WebSocket, sockets } = mockWebSocket();
    const client = createNorthmesClient({
      plantId: 'plant-a',
      apiUrl: 'https://api.northmes.test/mes',
      fetch,
      webSocketImpl: WebSocket,
    });

    await client.query({ query: gql`query Ping { ping }` });
    const subscription = client.subscribe({ query: boardChanged }).subscribe(() => {});
    await vi.waitFor(() => expect(sockets).toHaveLength(1));

    expect(fetch.mock.calls[0]?.[0]).toBe('https://api.northmes.test/mes/graphql');
    expect(sockets[0]?.url).toBe('wss://api.northmes.test/mes/graphql');
    subscription.unsubscribe();
  });

  it('E05-S05 with auth, each HTTP request carries the token that auth.token gives as its bearer token', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => graphqlResponse({ ping: 'pong' }));
    const tokens = ['jwt-1', 'jwt-2'];
    const client = createNorthmesClient({
      plantId: 'plant-a',
      fetch,
      auth: { token: async () => tokens.shift(), onUnauthenticated: () => {} },
    });

    await client.query({ query: gql`query Ping { ping }`, fetchPolicy: 'network-only' });
    await client.query({ query: gql`query Ping { ping }`, fetchPolicy: 'network-only' });

    const authorizations = fetch.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('authorization'),
    );
    expect(authorizations).toEqual(['Bearer jwt-1', 'Bearer jwt-2']);
  });

  it('E05-S05 with auth and no token, the request goes without an authorization header', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => graphqlResponse({ ping: 'pong' }));
    const client = createNorthmesClient({
      plantId: 'plant-a',
      fetch,
      auth: { token: async () => undefined, onUnauthenticated: () => {} },
    });

    await client.query({ query: gql`query Ping { ping }` });

    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).has('authorization')).toBe(false);
  });

  it('E05-S05 a 401 answer calls auth.onUnauthenticated, and the query fails', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(
          JSON.stringify({
            errors: [{ message: 'Unauthorized', extensions: { code: 'UNAUTHENTICATED' } }],
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    );
    const onUnauthenticated = vi.fn();
    const client = createNorthmesClient({
      plantId: 'plant-a',
      fetch,
      auth: { token: async () => 'jwt-1', onUnauthenticated },
    });

    const answer = await client.query({ query: gql`query Ping { ping }`, errorPolicy: 'all' });

    expect(answer.error).toBeDefined();
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it('E05-S05 an UNAUTHENTICATED GraphQL error calls auth.onUnauthenticated, and another error does not', async () => {
    const answerWith = (code: string) =>
      new Response(
        JSON.stringify({ data: null, errors: [{ message: code, extensions: { code } }] }),
        {
          headers: { 'content-type': 'application/graphql-response+json' },
        },
      );
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(answerWith('FORBIDDEN'))
      .mockResolvedValueOnce(answerWith('UNAUTHENTICATED'));
    const onUnauthenticated = vi.fn();
    const client = createNorthmesClient({
      plantId: 'plant-a',
      fetch,
      auth: { token: async () => 'jwt-1', onUnauthenticated },
    });
    const ping = () =>
      client.query({
        query: gql`query Ping { ping }`,
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      });

    await ping();
    const callsAfterForbidden = onUnauthenticated.mock.calls.length;
    await ping();

    expect(callsAfterForbidden).toBe(0);
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });
});
