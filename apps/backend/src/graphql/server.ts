// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { GraphQLError, type GraphQLSchema } from 'graphql';
import { createYoga, maskError, type YogaServerInstance } from 'graphql-yoga';
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

const logger = new Logger('GraphQL');

/** The stack of an error and of each error in its chain of causes, as the server log shows them. */
function stackOf(error: unknown): string {
  const lines: string[] = [];
  const seen = new Set<unknown>();
  for (let each = error; each !== undefined && !seen.has(each); each = (each as Error).cause) {
    seen.add(each);
    lines.push(each instanceof Error ? (each.stack ?? each.message) : String(each));
    if (!(each instanceof Error)) break;
  }
  return lines.join('\ncaused by: ');
}

/**
 * Masks an error that no resolver threw as a GraphQLError (ADR 0012): the client gets "Unexpected
 * error." with Yoga's code, errorCode core.internal and a correlation id, never the error's text,
 * whatever NODE_ENV says, and the server log gets one line at error level that names the same id
 * and holds the stack of the error and of its causes. Yoga calls it for every error it masks, in a
 * query, a mutation or an event of a subscription.
 */
function maskWithCorrelationId(error: unknown, message: string): Error {
  const masked = maskError(error, message, false);
  // A GraphQLError thrown as such, like the exception filter's, passes through unchanged.
  if (masked === error || !(masked instanceof GraphQLError)) return masked;
  const correlationId = randomUUID();
  const cause = error instanceof GraphQLError && error.originalError ? error.originalError : error;
  logger.error(`A GraphQL operation failed with correlation id ${correlationId}`, stackOf(cause));
  return new GraphQLError(masked.message, {
    nodes: masked.nodes,
    source: masked.source,
    positions: masked.positions,
    path: masked.path,
    extensions: { ...masked.extensions, errorCode: 'core.internal', correlationId },
  });
}

/**
 * Serves `schema` with GraphQL Yoga at GRAPHQL_PATH over HTTP, and subscriptions over SSE. Errors
 * that a resolver did not throw as a GraphQLError reach the client masked, with a correlation id
 * that the server log names (maskWithCorrelationId), and every operation
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
    maskedErrors: { maskError: maskWithCorrelationId },
    landingPage: false,
    graphiql: false,
  });
}
