// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  buildSchema,
  type GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isSpecifiedScalarType,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import { schemaSdl } from '../../src/graphql/schema-sdl.ts';

/**
 * Every element of the schema without a description, as Type, Type.field, Type.field(argument) or
 * Enum.VALUE. GraphQL's own types and scalars are left out, because graphql-js describes them.
 */
function undescribed(schema: GraphQLSchema): string[] {
  const missing: string[] = [];
  for (const type of Object.values(schema.getTypeMap())) {
    if (type.name.startsWith('__') || isSpecifiedScalarType(type)) continue;
    if (!type.description) missing.push(type.name);
    if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
      for (const field of Object.values(type.getFields())) {
        if (!field.description) missing.push(`${type.name}.${field.name}`);
        for (const arg of 'args' in field ? field.args : []) {
          if (!arg.description) missing.push(`${type.name}.${field.name}(${arg.name})`);
        }
      }
    }
    if (isEnumType(type)) {
      for (const value of type.getValues()) {
        if (!value.description) missing.push(`${type.name}.${value.name}`);
      }
    }
  }
  return missing;
}

describe('schemaSdl', () => {
  it('prints the one schema of the in-repo modules without a database or an environment', async () => {
    const sdl = await schemaSdl();
    const schema = buildSchema(sdl);

    expect(Object.keys(schema.getQueryType()?.getFields() ?? {})).toEqual([
      'coreArticle',
      'coreArticleFacets',
      'coreArticleGroup',
      'coreArticleGroups',
      'coreArticles',
      'coreCompanies',
      'coreDashboardTabs',
      'coreEquipment',
      'coreEquipmentGroup',
      'coreEquipmentGroups',
      'coreEquipmentList',
      'coreIntegrationTokens',
      'corePermissionCatalog',
      'corePlantRoleAssignments',
      'coreRole',
      'coreRoles',
      'coreUser',
      'coreUsers',
      'coreViewer',
      'planningProductionOrders',
    ]);
    expect(Object.keys(schema.getMutationType()?.getFields() ?? {})).toEqual([
      'coreArchiveArticle',
      'coreArchiveArticleGroup',
      'coreArchiveEquipment',
      'coreArchiveEquipmentGroup',
      'coreAssignRole',
      'coreBlockUser',
      'coreCreateArticle',
      'coreCreateArticleGroup',
      'coreCreateEquipment',
      'coreCreateEquipmentGroup',
      'coreCreateIntegrationToken',
      'coreCreateRole',
      'coreCreateUser',
      'coreDeleteRole',
      'coreRemoveRoleAssignment',
      'coreResetPassword',
      'coreRestoreArticle',
      'coreRestoreArticleGroup',
      'coreRestoreEquipment',
      'coreRestoreEquipmentGroup',
      'coreRevokeIntegrationToken',
      'coreSaveDashboardTab',
      'coreSetArticlePlants',
      'coreUnblockUser',
      'coreUpdateArticle',
      'coreUpdateArticleGroup',
      'coreUpdateEquipment',
      'coreUpdateEquipmentGroup',
      'coreUpdateRole',
      'coreUpsertArticle',
      'planningReleaseProductionOrder',
    ]);
    expect(sdl.endsWith('}\n')).toBe(true);
  });

  it('prints the types in name order, so the snapshot changes only where the schema does', async () => {
    const names = [...(await schemaSdl()).matchAll(/^(?:type|input|enum|scalar) (\w+)/gm)].map(
      ([, name]) => name,
    );

    expect(names).toEqual([...names].sort());
  });

  it('describes every type, field, argument and enum value, so the schema is the API reference', async () => {
    const schema = buildSchema(await schemaSdl());

    expect(undescribed(schema)).toEqual([]);
  });
});
