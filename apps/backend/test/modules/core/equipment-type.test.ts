// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { equipment } from '@northmes/core-contracts';
import { buildSchema, type GraphQLObjectType } from 'graphql';
import { describe, expect, it } from 'vitest';

/** The committed schema, which pnpm gen prints from the code and CI checks is current. */
const schema = buildSchema(
  readFileSync(new URL('../../../../../schema/api.graphql', import.meta.url), 'utf8'),
);

describe('Equipment', () => {
  it("E06-S05 the hand-written GraphQL type has the fields of the register's output schema and the group it reads", () => {
    const type = schema.getType('Equipment') as GraphQLObjectType;

    expect(Object.keys(type.getFields()).sort()).toEqual(
      [...Object.keys(equipment.node.shape), 'group'].sort(),
    );
  });
});
