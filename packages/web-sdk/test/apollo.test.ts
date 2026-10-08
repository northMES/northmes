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
});
