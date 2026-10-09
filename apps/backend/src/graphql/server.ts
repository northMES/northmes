// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GraphQLSchema } from 'graphql';
import { createYoga, type YogaServerInstance } from 'graphql-yoga';
import {
  noPrincipal,
  principalPlugin,
  type ResolvePrincipal,
  runAsPrincipalPlugin,
  type ServerContext,
} from './principal.ts';

/** The one GraphQL endpoint of the server. */
export const GRAPHQL_PATH = '/graphql';

/** The GraphQL server of the backend's one schema. */
export type GraphqlServer = YogaServerInstance<Record<string, unknown>, ServerContext>;

export interface GraphqlServerOptions {
  /** Resolves each request's principal. Without it, no request has one. */
  readonly resolvePrincipal?: ResolvePrincipal;
}

/**
 * Serves `schema` with GraphQL Yoga at GRAPHQL_PATH over HTTP, and subscriptions over SSE. Errors
 * that a resolver did not throw as a GraphQLError reach the client masked, and every operation
 * runs as the principal that `resolvePrincipal` resolves for its request.
 */
export function createGraphqlServer(
  schema: GraphQLSchema,
  { resolvePrincipal = noPrincipal }: GraphqlServerOptions = {},
): GraphqlServer {
  return createYoga<Record<string, unknown>, ServerContext>({
    schema,
    graphqlEndpoint: GRAPHQL_PATH,
    plugins: [principalPlugin(resolvePrincipal), runAsPrincipalPlugin],
    maskedErrors: true,
    landingPage: false,
    graphiql: false,
  });
}
