// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { checkRules, type SubgraphSdl } from '../../src/gateway/rules.ts';

/** The federation link every subgraph SDL starts with, as defineSubgraph prints it. */
const link =
  'extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key", "@shareable", "@external", "@requires"])';

/** A subgraph named after its module's GraphQL name, with the federation link before `sdl`. */
function subgraph(name: string, sdl: string): SubgraphSdl {
  return { name, sdl: `${link}\n${sdl}` };
}

describe('the NorthMES composition rules', () => {
  it('E02-S03 a root field without a module prefix fails with its rule id', () => {
    const gamma = subgraph(
      'gamma',
      `type Query { gammaThings: Int ping: String gammathings: Int }
       type Mutation { gammaRestart: Boolean restart: Boolean }
       type Subscription { gammaChanged: Int }`,
    );

    expect(checkRules([gamma])).toEqual([
      {
        code: 'NORTHMES_ROOT_FIELD_PREFIX',
        message: 'Query.ping of subgraph "gamma" must start with "gamma" and an upper-case letter',
      },
      {
        code: 'NORTHMES_ROOT_FIELD_PREFIX',
        message:
          'Query.gammathings of subgraph "gamma" must start with "gamma" and an upper-case letter',
      },
      {
        code: 'NORTHMES_ROOT_FIELD_PREFIX',
        message:
          'Mutation.restart of subgraph "gamma" must start with "gamma" and an upper-case letter',
      },
    ]);
  });

  it('E02-S03 a type owned by two modules fails with NORTHMES_TYPE_OWNERSHIP naming both subgraphs', () => {
    // Used only in outputs, composition would merge the two value sets without an error.
    const delta = subgraph('delta', 'enum Shift { EARLY LATE } type Query { deltaShift: Shift }');
    const epsilon = subgraph(
      'epsilon',
      'enum Shift { DAY NIGHT } type Query { epsilonShift: Shift }',
    );

    expect(checkRules([delta, epsilon])).toEqual([
      {
        code: 'NORTHMES_TYPE_OWNERSHIP',
        message:
          'Shift is defined in subgraphs "delta" and "epsilon"; one module owns a type that is not an entity',
      },
    ]);
  });
});
