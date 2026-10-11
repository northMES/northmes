// SPDX-License-Identifier: AGPL-3.0-or-later
import { maxAliasesPlugin } from '@escape.tech/graphql-armor-max-aliases';
import { maxDepthPlugin } from '@escape.tech/graphql-armor-max-depth';
import { maxTokensPlugin } from '@escape.tech/graphql-armor-max-tokens';
import { HttpStatus } from '@nestjs/common';
import { DomainError, toGraphQLError } from '@northmes/sdk/errors';
import { type ExecutionArgs, GraphQLError } from 'graphql';
import type { Plugin } from 'graphql-yoga';
import { operationCost } from './cost.ts';
import type { ServerContext } from './principal.ts';

/** The limits every GraphQL request must stay within (plan 05, audit finding B4). */
export interface GraphqlLimits {
  /** The largest request body in bytes, for every content type. */
  readonly maxBodyBytes: number;
  /** The deepest field nesting of an operation. */
  readonly maxDepth: number;
  /** The most aliases in one document. */
  readonly maxAliases: number;
  /** The most lexical tokens in one document. */
  readonly maxTokens: number;
  /** The highest cost of one operation. */
  readonly maxCost: number;
  /** The size a list costs when neither its first or last nor the schema gives one. */
  readonly defaultListSize: number;
  /** The cost each principal, or each client address without one, may spend per window. */
  readonly rateBudget: number;
  /** The length of a rate window in milliseconds. */
  readonly rateWindowMs: number;
  /** What every operation spends on top of its cost, so cheap operations count too. */
  readonly operationBaseCost: number;
}

/**
 * The numbers of plan 05: a depth of 12 allows three nested connection levels and a related object,
 * and a cost of 20 000 allows a table of 100 rows with a few related objects but not 100 rows with
 * 100 nested rows each. Express's JSON limit is 100 kB, so the cap for every other type is the same.
 * A budget of 200 000 a minute with a base cost of 100 lets a session load a 100-row list every
 * second, and holds a client to about 2000 cheap or 10 of the costliest operations a minute.
 */
export const graphqlLimits: GraphqlLimits = {
  maxBodyBytes: 100_000,
  maxDepth: 12,
  maxAliases: 15,
  maxTokens: 2000,
  maxCost: 20_000,
  defaultListSize: 25,
  rateBudget: 200_000,
  rateWindowMs: 60_000,
  operationBaseCost: 100,
};

/** The refusal of an operation that costs more than the limit. */
export function tooCostly(cost: number, maxCost: number): DomainError {
  return new DomainError({
    code: 'core.operation_too_costly',
    status: HttpStatus.BAD_REQUEST,
    message: `The operation costs ${cost}, more than the limit of ${maxCost}. Ask for fewer rows with first, or fewer nested lists.`,
    details: { cost, maxCost },
  });
}

/** A JSON answer with one error and `status`, for a request refused before GraphQL reads it. */
function refusal(fetchAPI: { Response: typeof Response }, status: number, message: string) {
  return new fetchAPI.Response(JSON.stringify({ errors: [{ message }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Refuses a POST whose body is over `maxBytes`, for every content type, before anything reads it:
 * 413 when Content-Length says so, and 411 when the body has no length. Express's JSON parser caps
 * only application/json, and Yoga reads the other types itself.
 */
export function bodyLimitPlugin(maxBytes: number): Plugin {
  return {
    onRequest({ request, endResponse, fetchAPI }) {
      if (request.method !== 'POST') return;
      const length = request.headers.get('content-length');
      if (length === null) {
        endResponse(refusal(fetchAPI, 411, 'The request body needs a Content-Length.'));
      } else if (!/^\d+$/.test(length) || Number(length) > maxBytes) {
        endResponse(
          refusal(fetchAPI, 413, `The request body is over the limit of ${maxBytes} bytes.`),
        );
      }
    },
  };
}

/**
 * Refuses an operation whose cost (operationCost) is over `maxCost` before any field runs. It runs
 * at execution, after validation, because the cost of a list depends on the variables.
 */
export function costLimitPlugin({ maxCost, defaultListSize }: GraphqlLimits): Plugin {
  const refusalOf = (args: ExecutionArgs) => {
    const cost = operationCost(args.schema, args.document, {
      operationName: args.operationName,
      variables: args.variableValues,
      defaultListSize,
    });
    if (cost <= maxCost) return undefined;
    const error = tooCostly(cost, maxCost);
    return { errors: [toGraphQLError(error) ?? error] };
  };
  return {
    onExecute({ args, setResultAndStopExecution }) {
      const result = refusalOf(args);
      if (result) setResultAndStopExecution(result);
    },
    onSubscribe({ args, setResultAndStopExecution }) {
      const result = refusalOf(args);
      if (result) setResultAndStopExecution(result);
    },
  };
}

/** The refusal of an operation over the rate limit, which Yoga answers with 429 and Retry-After. */
function rateLimited(retryAfterSeconds: number): GraphQLError {
  return new GraphQLError(`Too many requests. Try again in ${retryAfterSeconds} seconds.`, {
    extensions: {
      code: 'RATE_LIMITED',
      errorCode: 'core.rate_limited',
      details: { retryAfterSeconds },
      http: { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    },
  });
}

/**
 * Who a request's spending counts against: its principal, or for a request without one, the client
 * address that Express gives as req.ip, which follows Express's trust proxy setting (#476).
 */
function rateKeyOf(context: ServerContext & { req?: { ip?: string } }): string {
  if (context.principal) return `user:${context.principal.userId}`;
  return `address:${context.req?.ip ?? 'unknown'}`;
}

/**
 * Refuses an operation once its principal, or its client address without one, has spent
 * `rateBudget` in the current window of `rateWindowMs` (audit finding B4, #503). Each operation
 * spends `operationBaseCost` plus its cost (operationCost), so a client that sends many cheap
 * operations reaches the limit as one that sends a few costly ones does. The counters live in this
 * server's memory, so each replica counts on its own until a shared store exists.
 */
export function rateLimitPlugin(
  { rateBudget, rateWindowMs, operationBaseCost, defaultListSize }: GraphqlLimits,
  now: () => number = Date.now,
): Plugin<ServerContext> {
  const windows = new Map<string, { readonly start: number; spent: number }>();
  let swept = now();
  const refusalOf = (args: ExecutionArgs) => {
    const time = now();
    if (time - swept >= rateWindowMs) {
      for (const [key, window] of windows) {
        if (time - window.start >= rateWindowMs) windows.delete(key);
      }
      swept = time;
    }
    const key = rateKeyOf(args.contextValue as ServerContext);
    let window = windows.get(key);
    if (!window || time - window.start >= rateWindowMs) {
      window = { start: time, spent: 0 };
      windows.set(key, window);
    }
    const charge =
      operationBaseCost +
      operationCost(args.schema, args.document, {
        operationName: args.operationName,
        variables: args.variableValues,
        defaultListSize,
      });
    if (window.spent + charge > rateBudget) {
      const retryAfter = Math.ceil((window.start + rateWindowMs - time) / 1000);
      return { errors: [rateLimited(Math.max(1, retryAfter))] };
    }
    window.spent += charge;
    return undefined;
  };
  return {
    onExecute({ args, setResultAndStopExecution }) {
      const result = refusalOf(args);
      if (result) setResultAndStopExecution(result);
    },
    onSubscribe({ args, setResultAndStopExecution }) {
      const result = refusalOf(args);
      if (result) setResultAndStopExecution(result);
    },
  };
}

/**
 * The plugins that hold every request within `limits`, in the order they act: the body cap before
 * the body is read, the token limit while it parses, the depth and alias limits while it
 * validates, and the cost limit before it runs. The limits are named in their errors, so a client
 * developer knows what to change.
 */
export function limitPlugins(limits: GraphqlLimits = graphqlLimits): Plugin[] {
  return [
    bodyLimitPlugin(limits.maxBodyBytes),
    maxTokensPlugin({ n: limits.maxTokens }),
    maxDepthPlugin({ n: limits.maxDepth }),
    maxAliasesPlugin({ n: limits.maxAliases }),
    costLimitPlugin(limits),
  ];
}
