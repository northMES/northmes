// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { GraphQLSchema } from 'graphql';
import { createYoga, type YogaServerInstance } from 'graphql-yoga';
import { type GraphqlLimits, graphqlLimits, limitPlugins, rateLimitPlugin } from './limits.ts';
import { plantFreePlugin } from './plant-free.ts';
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
  /** The limits every request must stay within. */
  readonly limits?: GraphqlLimits;
  /** The clock of the rate limit, which a test moves. */
  readonly now?: () => number;
}

/**
 * Serves `schema` with GraphQL Yoga at GRAPHQL_PATH over HTTP, and subscriptions over SSE. Errors
 * that a resolver did not throw as a GraphQLError reach the client masked, and every operation
 * runs as the principal that `resolvePrincipal` resolves for its request. An operation whose
 * request names no plant runs only plant-free root fields (ADR 0066). Every request stays within
 * `limits` (plan 05), each principal or client address within the rate limit (#503), and multipart requests are refused until uploads exist (ADR 0054).
 */
export function createGraphqlServer(
  schema: GraphQLSchema,
  { resolvePrincipal = noPrincipal, limits = graphqlLimits, now }: GraphqlServerOptions = {},
): GraphqlServer {
  return createYoga<Record<string, unknown>, ServerContext>({
    schema,
    graphqlEndpoint: GRAPHQL_PATH,
    plugins: [
      ...limitPlugins(limits),
      principalPlugin(resolvePrincipal),
      // After the principal, whose spending it counts.
      rateLimitPlugin(limits, now),
      plantFreePlugin,
      runAsPrincipalPlugin,
    ],
    multipart: false,
    maskedErrors: true,
    landingPage: false,
    graphiql: false,
  });
}
