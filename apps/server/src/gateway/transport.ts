// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  createDefaultExecutor,
  type Executor,
  type Transport,
} from '@graphql-mesh/transport-common';
import type { SubgraphContext, SubgraphEntry } from '@northmes/sdk/graphql';
import type { GraphQLSchema } from 'graphql';

/**
 * Executes every subgraph call in this process against the subgraph's own schema, with no HTTP
 * hop (ADR 0015).
 */
export function inProcessTransport(subgraphs: readonly SubgraphEntry[]): Transport {
  const byName = new Map(subgraphs.map((subgraph) => [subgraph.name, subgraph]));
  return {
    getSubgraphExecutor({ subgraphName }) {
      const subgraph = byName.get(subgraphName);
      if (!subgraph) throw new Error(`No in-process subgraph named ${subgraphName}`);
      return subgraphExecutor(subgraph.schema);
    },
  };
}

/**
 * Runs operations on one subgraph. The gateway passes the same context object to every call of
 * one client request, so the executor keeps one subgraph context per client request, and a
 * loader's cache serves every _entities call of that request.
 */
function subgraphExecutor(schema: GraphQLSchema): Executor {
  const execute = createDefaultExecutor(schema);
  const contexts = new WeakMap<object, SubgraphContext>();
  return (request) => {
    const requestContext: object | undefined = request.context;
    let context = requestContext && contexts.get(requestContext);
    if (!context) {
      context = { loaders: new Map() };
      if (requestContext) contexts.set(requestContext, context);
    }
    return execute({ ...request, context });
  };
}
