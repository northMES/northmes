// SPDX-License-Identifier: MIT
import type { GraphQLFormattedError } from 'graphql';

/** What /graphql answered: the HTTP status, and the GraphQL result when the body is JSON. */
export interface GqlAnswer<TData = Record<string, unknown>> {
  readonly status: number;
  readonly data?: TData | null;
  readonly errors?: readonly GraphQLFormattedError[];
}

export interface GqlClient {
  /** Sends one operation as a JSON POST to /graphql. */
  send<TData = Record<string, unknown>>(
    document: string,
    variables?: Readonly<Record<string, unknown>>,
  ): Promise<GqlAnswer<TData>>;
}

export interface GqlClientOptions {
  /**
   * Headers sent with every operation, such as x-northmes-plant, which names the request's plant
   * until sign-in arrives (E05).
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
  };
}
