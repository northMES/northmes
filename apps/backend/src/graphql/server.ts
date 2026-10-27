// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import { Logger } from '@nestjs/common';
import { GraphQLError, type GraphQLSchema } from 'graphql';
import { createYoga, maskError, type YogaLogger, type YogaServerInstance } from 'graphql-yoga';
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

/** A credential in a URL, such as a connection string's password, which no log line may hold. */
const URL_CREDENTIAL = /\/\/([^/\s:@]+):([^/\s@]+)@/g;

/**
 * The stack of an error and of each error in its chain of causes, as the server log shows them,
 * with the password of any URL in them replaced.
 */
function stackOf(error: unknown): string {
  const lines: string[] = [];
  const seen = new Set<unknown>();
  for (let each = error; each !== undefined && !seen.has(each); each = (each as Error).cause) {
    seen.add(each);
    lines.push(each instanceof Error ? (each.stack ?? each.message) : inspect(each));
    if (!(each instanceof Error)) break;
  }
  return lines.join('\ncaused by: ').replace(URL_CREDENTIAL, '//$1:***@');
}

/** The correlation id that maskWithCorrelationId gave each masked error, for yogaLogger's line. */
const correlationIds = new WeakMap<object, string>();

/** The log line of a masked error, which names the id the client got. */
function logMasked(error: unknown, correlationId: string): void {
  const cause = error instanceof GraphQLError && error.originalError ? error.originalError : error;
  logger.error(`A GraphQL operation failed with correlation id ${correlationId}`, stackOf(cause));
}

/**
 * Masks an error that no resolver threw as a GraphQLError (ADR 0012): the client gets "Unexpected
 * error." with Yoga's code, errorCode core.internal and a correlation id, never the error's text,
 * whatever NODE_ENV says. Yoga calls it for every error it masks, in a query, a mutation or an event
 * of a subscription, and then hands the error to its logger, where yogaLogger writes the one log
 * line that names the same id. An error that is no object cannot wait for the logger, so its line
 * is written here.
 */
function maskWithCorrelationId(error: unknown, message: string): Error {
  const masked = maskError(error, message, false);
  // A GraphQLError thrown as such, like the exception filter's, passes through unchanged.
  if (masked === error || !(masked instanceof GraphQLError)) return masked;
  const correlationId = randomUUID();
  if (typeof error === 'object' && error !== null) correlationIds.set(error, correlationId);
  else logMasked(error, correlationId);
  return new GraphQLError(masked.message, {
    nodes: masked.nodes,
    source: masked.source,
    positions: masked.positions,
    path: masked.path,
    extensions: { ...masked.extensions, errorCode: 'core.internal', correlationId },
  });
}

/** One log line of what Yoga logs, each argument inspected. */
function lineOf(args: readonly unknown[]): string {
  return args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg))).join(' ');
}

/**
 * Yoga's log, written through the server's Logger at the same levels, without Yoga's debug lines,
 * which its default logger leaves out too. An error Yoga logs after masking it gets the line of
 * logMasked, with the stack of the error and of its causes, instead of Yoga's own, so a masked
 * error gives one line, which names the correlation id.
 */
const yogaLogger: YogaLogger = {
  debug: () => {},
  info: (...args) => logger.log(lineOf(args)),
  warn: (...args) => logger.warn(lineOf(args)),
  error: (...args) => {
    const [error] = args;
    const correlationId =
      typeof error === 'object' && error !== null ? correlationIds.get(error) : undefined;
    if (correlationId === undefined) logger.error(lineOf(args));
    else logMasked(error, correlationId);
  },
};

/**
 * Serves `schema` with GraphQL Yoga at GRAPHQL_PATH over HTTP, and subscriptions over SSE. Errors
 * that a resolver did not throw as a GraphQLError reach the client masked, with a correlation id
 * that the server log names (maskWithCorrelationId and yogaLogger), and every operation runs as
 * the principal that `resolvePrincipal` resolves for its request. An operation whose
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
    logging: yogaLogger,
    landingPage: false,
    graphiql: false,
  });
}
