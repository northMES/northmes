// SPDX-License-Identifier: AGPL-3.0-or-later
import { createTestApp, query, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { can } from '../../../src/modules/core/core/access/access.ts';
import { PrincipalService } from '../../../src/modules/core/core/access/principal.service.ts';
import { givenCompany, givenUser, hostFactory } from '../../../src/testing.ts';

describe('roles, role assignments and the permission catalog', () => {
  const db = useTestDatabase();
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  /** The principal of a user, as the server resolves it once per request. */
  function principalOf(userId: string) {
    return testApp.app.get(PrincipalService).forUser(userId);
  }

  it('E05-S06 northmes migrate writes every permission the modules declare into core.permission', async () => {
    const rows = await query(
      db.appUrl,
      "select key, module_id, installed from core.permission where key like '%Order:%' or key like 'core.article:%' order by key",
    );

    expect(rows).toEqual([
      { key: 'core.article:create', module_id: 'core', installed: true },
      { key: 'core.article:read', module_id: 'core', installed: true },
      { key: 'core.article:update', module_id: 'core', installed: true },
      { key: 'planning.productionOrder:read', module_id: 'planning', installed: true },
      { key: 'planning.productionOrder:release', module_id: 'planning', installed: true },
    ]);
  });

  it('E05-S06 can() walks the scope tree: an assignment at the company grants each plant, one at a plant grants neither its sibling nor the company', async () => {
    const { company, plants } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plantA = '', plantB = ''] = plants;
    const companyPlanner = await givenUser(db.ownerUrl, [
      { scopeId: company, permissions: ['planning.productionOrder:release'] },
    ]);
    const plantAPlanner = await givenUser(db.ownerUrl, [
      { scopeId: plantA, permissions: ['planning.productionOrder:release'] },
    ]);

    const atCompany = await principalOf(companyPlanner);
    const atPlantA = await principalOf(plantAPlanner);

    expect(can(atCompany, 'planning.productionOrder:release', plantA)).toBe(true);
    expect(can(atCompany, 'planning.productionOrder:release', plantB)).toBe(true);
    expect(can(atPlantA, 'planning.productionOrder:release', plantA)).toBe(true);
    expect(can(atPlantA, 'planning.productionOrder:release', plantB)).toBe(false);
    expect(can(atPlantA, 'planning.productionOrder:release', company)).toBe(false);
  });

  it("E05-S04 the principal's read and write scopes come from its role assignments", async () => {
    const { company, plants } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plantA = ''] = plants;
    const userId = await givenUser(db.ownerUrl, [
      { scopeId: plantA, permissions: ['core.article:read', 'core.article:update'] },
    ]);

    const principal = await principalOf(userId);

    expect(principal.readScopes).toEqual([company, plantA].sort());
    expect(principal.writeScopes).toEqual([plantA]);
  });

  it('E05-S06 a permission that no installed module declares grants nothing', async () => {
    const { plants } = await givenCompany(db.ownerUrl);
    const [plant = ''] = plants;
    const userId = await givenUser(db.ownerUrl, [
      { scopeId: plant, permissions: ['quality.inspection:read'] },
    ]);

    const principal = await principalOf(userId);

    expect(can(principal, 'quality.inspection:read', plant)).toBe(false);
    expect(principal.readScopes).toEqual([]);
  });
});
