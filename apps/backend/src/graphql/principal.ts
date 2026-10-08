// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RequestContext } from '@northmes/sdk/graphql';
import { isAsyncIterable, type Plugin } from 'graphql-yoga';
import { type Principal, runAs } from '../principal.ts';

/** The header that names a request's plant by its scope id, until plant slugs arrive (E05-S03). */
export const PLANT_HEADER = 'x-northmes-plant';

/** What the server adds to the context of every request. */
export interface ServerContext extends RequestContext {
  /** Who the request acts as, or null for a request without a principal. */
  readonly principal: Principal | null;
}

/**
 * The principal of a request at a plant until sign-in, roles and the plant check exist (E05-S03 to
 * E05-S06): it holds every permission, and both of its scope sets hold the plant alone.
 */
export function tracerPrincipal(plantId: string): Principal {
  return {
    plantId,
    readScopes: [plantId],
    writeScopes: [plantId],
    can: () => true,
  };
}

/**
 * Resolves the principal once per request from the plant in its x-northmes-plant header, and adds
 * it to the context as `principal`, next to the request's empty loaders. A request without the
 * header gets null, so it reads nothing. The plant comes from the HTTP request alone, which for a
 * graphql-ws subscription is its handshake: no NorthMES code reads a socket's connectionParams
 * (ADR 0011, ADR 0018).
 */
export const tracerPrincipalPlugin: Plugin<ServerContext> = {
  onContextBuilding({ context, extendContext }) {
    const plantId = context.request.headers.get(PLANT_HEADER);
    extendContext({ principal: plantId ? tracerPrincipal(plantId) : null, loaders: new Map() });
  },
};

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
