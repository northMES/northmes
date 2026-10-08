// SPDX-License-Identifier: MIT
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

export interface CreateNorthmesClientOptions {
  /** The plant's scope id. Every HTTP request names it in x-northmes-plant. */
  readonly plantId: string;
  /** Replaces the global fetch, for tests. */
  readonly fetch?: typeof fetch;
}

/**
 * Returns the Apollo client for one plant (ADR 0018). Only the shell calls it, and a plant switch
 * creates a new client.
 */
export function createNorthmesClient(options: CreateNorthmesClientOptions): ApolloClient {
  return new ApolloClient({
    link: new HttpLink({
      uri: '/graphql',
      headers: { 'x-northmes-plant': options.plantId },
      fetch: options.fetch,
    }),
    cache: new InMemoryCache(),
  });
}
