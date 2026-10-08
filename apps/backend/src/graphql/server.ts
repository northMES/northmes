// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GraphQLSchema } from 'graphql';
import { createYoga, type YogaServerInstance } from 'graphql-yoga';
import { runAsPrincipalPlugin, type ServerContext, tracerPrincipalPlugin } from './principal.ts';

/** The one GraphQL endpoint of the server. */
export const GRAPHQL_PATH = '/graphql';

/** The GraphQL server of the backend's one schema. */
export type GraphqlServer = YogaServerInstance<Record<string, unknown>, ServerContext>;

/**
 * Serves `schema` with GraphQL Yoga at GRAPHQL_PATH over HTTP, and subscriptions over SSE. Errors
 * that a resolver did not throw as a GraphQLError reach the client masked, and every operation
 * runs as the principal of its request.
 */
export function createGraphqlServer(schema: GraphQLSchema): GraphqlServer {
  return createYoga<Record<string, unknown>, ServerContext>({
    schema,
    graphqlEndpoint: GRAPHQL_PATH,
    plugins: [tracerPrincipalPlugin, runAsPrincipalPlugin],
    maskedErrors: true,
    landingPage: false,
    graphiql: false,
  });
}
