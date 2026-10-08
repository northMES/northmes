// SPDX-License-Identifier: MIT
import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';

/** The API's one endpoint, for HTTP and for graphql-ws (ADR 0018). */
const graphqlPath = 'graphql';

export interface CreateNorthmesClientOptions {
  /** The plant's scope id. Every HTTP request names it in x-northmes-plant. */
  readonly plantId: string;
  /**
   * The URL of the API, such as https://mes.example.com or one with a path prefix. The client
   * sends its requests to <apiUrl>/graphql. Without one, it uses the page's origin.
   */
  readonly apiUrl?: string;
  /** Replaces the global fetch, for tests. */
  readonly fetch?: typeof fetch;
  /** Replaces the global WebSocket class, for tests. */
  readonly webSocketImpl?: unknown;
}

/**
 * Returns the Apollo client for one plant (ADR 0018). Only the shell calls it, and a plant switch
 * creates a new client.
 *
 * Subscriptions run over the client's own graphql-ws connection, which sends no connectionParams:
 * each subscription names its plant in its plantId argument, and the server takes the principal
 * from the handshake cookie.
 */
export function createNorthmesClient(options: CreateNorthmesClientOptions): ApolloClient {
  const http = new HttpLink({
    uri: options.apiUrl === undefined ? `/${graphqlPath}` : graphqlUrl(options.apiUrl).href,
    headers: { 'x-northmes-plant': options.plantId },
    fetch: options.fetch,
  });
  const ws = new GraphQLWsLink(
    createClient({
      // The browser floor (ADR 0019) has WebSocket constructors that need an absolute URL.
      url: () => webSocketUrl(graphqlUrl(options.apiUrl ?? location.origin)),
      webSocketImpl: options.webSocketImpl,
    }),
  );
  return new ApolloClient({
    link: ApolloLink.split(
      (operation) => operation.operationType === OperationTypeNode.SUBSCRIPTION,
      ws,
      http,
    ),
    cache: new InMemoryCache(),
  });
}

/** The /graphql endpoint below apiUrl, which keeps apiUrl's path prefix. */
function graphqlUrl(apiUrl: string): URL {
  return new URL(graphqlPath, apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
}

/** The graphql-ws URL of an HTTP endpoint: wss for https, ws for http. */
function webSocketUrl(url: URL): string {
  const socket = new URL(url);
  socket.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return socket.href;
}
