// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildSubgraphSchema, printSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { checkRules, type SubgraphSdl } from '../../src/gateway/rules.ts';

/** The federation link of every subgraph, as defineSubgraph declares it. */
const link =
  'extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key", "@shareable", "@external", "@requires"])';

/**
 * A subgraph named after its module's GraphQL name, whose SDL is printed the way defineSubgraph
 * prints it: with federation's own root fields, directives and types. `entityRefs` names the
 * entities of other modules that the module references through entityRef.
 */
function subgraph(name: string, typeDefs: string, entityRefs: readonly string[] = []): SubgraphSdl {
  const schema = buildSubgraphSchema(parse(`${link}\n${typeDefs}`));
  return { name, sdl: printSubgraphSchema(schema), entityRefs };
}

describe('the NorthMES composition rules', () => {
  it("E02-S03 federation's own root fields and types break no rule", () => {
    const alpha = subgraph(
      'alpha',
      'type Thing @key(fields: "id") { id: ID! name: String } type Query { alphaThing: Thing }',
    );
    const beta = subgraph(
      'beta',
      'type Crate @key(fields: "id") { id: ID! } type Query { betaCrates: [Crate!]! }',
    );

    expect(checkRules([alpha, beta])).toEqual([]);
  });

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

  it('E02-S03 PageInfo in two subgraphs breaks no rule, as an SDK shared type', () => {
    const pageInfo = 'type PageInfo @shareable { hasNextPage: Boolean! endCursor: String }';
    const delta = subgraph(
      'delta',
      `${pageInfo} type ShiftConnection { pageInfo: PageInfo! } type Query { deltaShifts: ShiftConnection! }`,
    );
    const epsilon = subgraph(
      'epsilon',
      `${pageInfo} type CrewConnection { pageInfo: PageInfo! } type Query { epsilonCrews: CrewConnection! }`,
    );

    expect(checkRules([delta, epsilon])).toEqual([]);
  });

  it('E02-S03 a non-nullable contributed field fails with NORTHMES_CONTRIBUTED_FIELD_NULLABLE naming the field', () => {
    const alpha = subgraph(
      'alpha',
      'type Thing @key(fields: "id") { id: ID! name: String! } type Query { alphaThing(id: ID!): Thing }',
    );
    // Zeta references alpha's Thing and adds two fields to it, one of them non-null.
    const zeta = subgraph(
      'zeta',
      'type Thing @key(fields: "id") { id: ID! zetaWeight: Int! zetaColour: String } type Query { zetaPing: String }',
      ['Thing'],
    );

    expect(checkRules([alpha, zeta])).toEqual([
      {
        code: 'NORTHMES_CONTRIBUTED_FIELD_NULLABLE',
        message:
          'Thing.zetaWeight must be nullable: subgraph "zeta" adds it to an entity that subgraph "alpha" owns',
      },
    ]);
  });
});
