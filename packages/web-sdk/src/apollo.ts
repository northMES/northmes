// SPDX-License-Identifier: MIT
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  type ErrorLike,
  HttpLink,
  InMemoryCache,
  ServerError,
} from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';

/** The API's one endpoint, for HTTP and for graphql-ws (ADR 0018). */
const graphqlPath = 'graphql';

/** How the client signs its HTTP requests in, and what it does when the API refuses them. */
export interface NorthmesClientAuth {
  /**
   * The bearer token of the next request, such as a short-lived JWT, or undefined when nobody is
   * signed in. The client calls it once per request, so it can hand out a new token before the
   * last one expires.
   */
  readonly token: () => Promise<string | undefined>;
  /** Called when the API answers 401 or with an UNAUTHENTICATED GraphQL error. */
  readonly onUnauthenticated: () => void;
}

export interface CreateNorthmesClientOptions {
  /** The plant's scope id. Every HTTP request names it in x-northmes-plant. */
  readonly plantId: string;
  /**
   * The URL of the API, such as https://mes.example.com or one with a path prefix. The client
   * sends its requests to <apiUrl>/graphql. Without one, it uses the page's origin.
   */
  readonly apiUrl?: string;
  /** Signs each HTTP request in with a bearer token. Without it, requests carry no credential. */
  readonly auth?: NorthmesClientAuth;
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
  const auth = options.auth;
  return new ApolloClient({
    link: ApolloLink.split(
      (operation) => operation.operationType === OperationTypeNode.SUBSCRIPTION,
      ws,
      auth === undefined ? http : ApolloLink.from([authLink(auth), http]),
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

/**
 * The links that sign an HTTP request in: the first puts auth.token() in the authorization header,
 * the second calls auth.onUnauthenticated when the API refuses the request as unauthenticated.
 */
function authLink(auth: NorthmesClientAuth): ApolloLink {
  const bearer = new SetContextLink(async ({ headers }) => {
    const token = await auth.token();
    return token === undefined ? {} : { headers: { ...headers, authorization: `Bearer ${token}` } };
  });
  const refused = new ErrorLink(({ error }) => {
    if (isUnauthenticated(error)) auth.onUnauthenticated();
  });
  return ApolloLink.from([refused, bearer]);
}

/** A 401 answer, or a GraphQL error with the code UNAUTHENTICATED. */
function isUnauthenticated(error: ErrorLike): boolean {
  if (ServerError.is(error)) return error.statusCode === 401;
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some(({ extensions }) => extensions?.code === 'UNAUTHENTICATED')
  );
}
