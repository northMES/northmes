// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TransportGetSubgraphExecutorOptions } from '@graphql-mesh/transport-common';
import type { SubgraphContext } from '@northmes/sdk/graphql';
import { GraphQLObjectType, GraphQLSchema, GraphQLString, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { inProcessTransport } from '../../src/gateway/transport.ts';

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

describe('inProcessTransport', () => {
  it('E02-S03 the in-process transport keeps one subgraph context per client request and subgraph', async () => {
    const { entry, seen } = recordingSubgraph();
    // The in-process transport reads only the subgraph name of the options the gateway passes.
    const options = { subgraphName: 'probe' } as TransportGetSubgraphExecutorOptions;
    const execute = await inProcessTransport([entry]).getSubgraphExecutor(options);
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
});
