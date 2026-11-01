// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { equipmentGroups } from '@northmes/core-contracts';
import { buildSchema, type GraphQLObjectType } from 'graphql';
import { describe, expect, it } from 'vitest';

/** The committed schema, which pnpm gen prints from the code and CI checks is current. */
const schema = buildSchema(
  readFileSync(new URL('../../../../../schema/api.graphql', import.meta.url), 'utf8'),
);

describe('EquipmentGroup', () => {
  it("E06-S04 the hand-written GraphQL type has exactly the fields of the register's output schema", () => {
    const type = schema.getType('EquipmentGroup') as GraphQLObjectType;

    expect(Object.keys(type.getFields()).sort()).toEqual(
      Object.keys(equipmentGroups.node.shape).sort(),
    );
  });
});
