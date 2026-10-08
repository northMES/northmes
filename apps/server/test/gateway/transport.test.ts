// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TransportGetSubgraphExecutorOptions } from '@graphql-mesh/transport-common';
import type { SubgraphContext } from '@northmes/sdk/graphql';
import { given } from '@northmes/testing';
import { GraphQLObjectType, GraphQLSchema, GraphQLString, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { tracerPrincipal } from '../../src/gateway/tracer-principal.ts';
import { inProcessTransport } from '../../src/gateway/transport.ts';
import { currentPrincipal, type Principal } from '../../src/principal.ts';

/** A subgraph whose one Query field records the context each call receives. */
function recordingSubgraph() {
  const seen: SubgraphContext[] = [];
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        probeContext: {
          type: GraphQLString,
          resolve: (_source, _args, context: SubgraphContext) => {
            seen.push(context);
            return 'seen';
          },
        },
      },
    }),
  });
  return { entry: { name: 'probe', sdl: 'type Query { probeContext: String }', schema }, seen };
}

/** A subgraph whose one Query field records the principal it runs as, after an await. */
function principalSubgraph() {
  const seen: (Principal | null)[] = [];
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        probePrincipal: {
          type: GraphQLString,
          resolve: async () => {
            await Promise.resolve();
            seen.push(currentPrincipal());
            return 'seen';
          },
        },
      },
    }),
  });
  return { entry: { name: 'probe', sdl: 'type Query { probePrincipal: String }', schema }, seen };
}

// The in-process transport reads only the subgraph name of the options the gateway passes.
const probeOptions = { subgraphName: 'probe' } as TransportGetSubgraphExecutorOptions;

describe('inProcessTransport', () => {
  it('E02-S03 the in-process transport keeps one subgraph context per client request and subgraph', async () => {
    const { entry, seen } = recordingSubgraph();
    const execute = await inProcessTransport([entry]).getSubgraphExecutor(probeOptions);
    const document = parse('{ probeContext }');
    const firstRequest = {};
    const secondRequest = {};

    await execute({ document, context: firstRequest });
    await execute({ document, context: firstRequest });
    await execute({ document, context: secondRequest });

    expect(seen).toHaveLength(3);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).not.toBe(seen[0]);
  });

  it("E02-S04 a subgraph call runs as the principal of the client request's context", async () => {
    const { entry, seen } = principalSubgraph();
    const execute = await inProcessTransport([entry]).getSubgraphExecutor(probeOptions);
    const document = parse('{ probePrincipal }');
    const principal = tracerPrincipal(given.plant());

    // The tracer principal plugin adds `principal` to the gateway context of each client request.
    await execute({ document, context: { principal } });
    await execute({ document, context: { principal: null } });

    expect(seen).toEqual([principal, null]);
  });
});
