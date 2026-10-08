// SPDX-License-Identifier: MIT
import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';

export interface CreateNorthmesClientOptions {
  /** The plant's scope id. Every HTTP request names it in x-northmes-plant. */
  readonly plantId: string;
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
    uri: '/graphql',
    headers: { 'x-northmes-plant': options.plantId },
    fetch: options.fetch,
  });
  const ws = new GraphQLWsLink(
    createClient({ url: '/graphql', webSocketImpl: options.webSocketImpl }),
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
