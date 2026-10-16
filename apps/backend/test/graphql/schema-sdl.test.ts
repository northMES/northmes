// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { schemaSdl } from '../../src/graphql/schema-sdl.ts';

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
      'coreAssignRole',
      'coreBlockUser',
      'coreCreateArticle',
      'coreCreateArticleGroup',
      'coreCreateRole',
      'coreCreateUser',
      'coreDeleteRole',
      'coreRemoveRoleAssignment',
      'coreResetPassword',
      'coreRestoreArticle',
      'coreRestoreArticleGroup',
      'coreSaveDashboardTab',
      'coreSetArticlePlants',
      'coreUnblockUser',
      'coreUpdateArticle',
      'coreUpdateArticleGroup',
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
});
