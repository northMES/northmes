// SPDX-License-Identifier: AGPL-3.0-or-later
import { toGraphQLError } from '@northmes/sdk/errors';
import type { RequestContext } from '@northmes/sdk/graphql';
import { isAsyncIterable, type Plugin } from 'graphql-yoga';
import { type Principal, runAs } from '../principal.ts';

/** What the server adds to the context of every request. */
export interface ServerContext extends RequestContext {
  /** Who the request acts as, or null for a request without a principal. */
  readonly principal: Principal | null;
}

/** Resolves the principal of a request from its headers, or null. */
export type ResolvePrincipal = (headers: Headers) => Promise<Principal | null>;

/** The resolver of a server without the core module: no request has a principal. */
export const noPrincipal: ResolvePrincipal = async () => null;

/**
 * Resolves the principal once per request with `resolve`, from the request's headers, and adds it
 * to the context as `principal`, next to the request's empty loaders (ADR 0011). A request without
 * a valid bearer token gets null, so it reads nothing, and the principal guard refuses its fields.
 * When `resolve` refuses the request, such as for a plant in x-northmes-plant that the principal
 * may not open, the request fails with that refusal as its one error and runs no field.
 * The headers come from the HTTP request alone, which for a graphql-ws subscription is its
 * handshake: no NorthMES code reads a socket's connectionParams (ADR 0018).
 */
export function principalPlugin(resolve: ResolvePrincipal): Plugin<ServerContext> {
  return {
    async onContextBuilding({ context, extendContext }) {
      let principal: Principal | null;
      try {
        principal = await resolve(context.request.headers);
      } catch (error) {
        throw toGraphQLError(error) ?? error;
      }
      extendContext({ principal, loaders: new Map() });
    },
  };
}

/**
 * Runs every operation as the principal of its request, so the ScopedDatabase transactions its
 * resolvers start use that principal's scope sets. A subscription runs each event as that
 * principal, and each event starts with no loaders, so an event never reads a value that an
 * earlier event cached.
 */
export const runAsPrincipalPlugin: Plugin<ServerContext> = {
  onExecute({ executeFn, setExecuteFn }) {
    setExecuteFn((args) =>
      runAs((args.contextValue as ServerContext).principal, () => executeFn(args)),
    );
  },
  onSubscribe({ subscribeFn, setSubscribeFn }) {
    setSubscribeFn(async (args) => {
      const context = args.contextValue as ServerContext;
      const result = await runAs(context.principal, () => subscribeFn(args));
      return isAsyncIterable(result) ? eventsAs(context, result) : result;
    });
  },
};

/** The events of a subscription, each pulled as the request's principal and with no loaders. */
function eventsAs<T>(context: ServerContext, events: AsyncIterable<T>): AsyncIterableIterator<T> {
  const iterator = events[Symbol.asyncIterator]();
  return {
    next: () => {
      context.loaders.clear();
      return runAs(context.principal, () => iterator.next());
    },
    return: async (value?: unknown) =>
      (await iterator.return?.(value)) ?? { done: true, value: undefined },
    throw: async (error?: unknown) => {
      if (iterator.throw) return iterator.throw(error);
      throw error;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
