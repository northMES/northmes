// SPDX-License-Identifier: AGPL-3.0-or-later
import { createTestApp, query, type TestApp, useTestDatabase } from '@northmes/testing';
import { Client } from 'pg';
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

  /**
   * Runs one statement as core's owner role and answers the SQLSTATE that Postgres refused it with,
   * or 'accepted'. The statement rolls back either way.
   */
  async function asCoreOwner(sql: string, params: readonly unknown[]): Promise<string> {
    const client = new Client({ connectionString: db.ownerUrl });
    await client.connect();
    try {
      await client.query('begin');
      await client.query('set local role nm_mod_core');
      await client.query(sql, [...params]);
      return 'accepted';
    } catch (error) {
      return (error as { code?: string }).code ?? String(error);
    } finally {
      await client.query('rollback').catch(() => undefined);
      await client.end();
    }
  }

  /** The principal of a user at the plant with this slug, as the server resolves it per request. */
  function principalOf(userId: string, plant?: string) {
    return testApp.app.get(PrincipalService).forUser(userId, plant);
  }

  it('E05-S06 northmes migrate writes every permission the modules declare into core.permission', async () => {
    const rows = await query(
      db.appUrl,
      "select key, module_id, installed from core.permission where key like '%Order:%' or key like 'core.article:%' order by key",
    );

    expect(rows).toEqual([
      { key: 'core.article:archive', module_id: 'core', installed: true },
      { key: 'core.article:assign', module_id: 'core', installed: true },
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

  it("E05-S04 the principal's read and write scopes come from its role assignments at the request's plant", async () => {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plantA = ''] = plants;
    const userId = await givenUser(db.ownerUrl, [
      { scopeId: plantA, permissions: ['core.article:read', 'core.article:update'] },
    ]);

    const principal = await principalOf(userId, slugs[0]);

    expect(principal.plantId).toBe(plantA);
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

  it("E05-S06 a role belongs to a company node, and a role assignment's role and scope are of one company", async () => {
    const x = await givenCompany(db.ownerUrl);
    const y = await givenCompany(db.ownerUrl);
    const [plantY = ''] = y.plants;
    // givenUser gives the user a role of company X, assigned at X.
    const userId = await givenUser(db.ownerUrl, [
      { scopeId: x.company, permissions: ['core.article:read'] },
    ]);
    const [roleOfX] = await query<{ id: string }>(
      db.appUrl,
      `select role_id as id from core.role_assignment where user_id = '${userId}'`,
    );
    const roleId = roleOfX?.id ?? '';

    const roleAtPlant = await asCoreOwner(
      "insert into core.role (company_id, key, name, origin) values ($1, 'at-plant', 'At plant', 'custom')",
      [plantY],
    );
    const roleOfXAtY = await asCoreOwner(
      `insert into core.role_assignment (user_id, scope_id, role_id, company_id)
       values ($1, $2, $3, $4)`,
      [userId, plantY, roleId, y.company],
    );
    const plantOfYUnderX = await asCoreOwner(
      `insert into core.scope (company_id, parent_id, kind, span)
       values ($1, $2, 'plant', int8range(2::int8 << 32, 3::int8 << 32))`,
      [y.company, x.company],
    );

    expect(roleId).not.toBe('');
    expect({ roleAtPlant, roleOfXAtY, plantOfYUnderX }).toEqual({
      roleAtPlant: '23503',
      roleOfXAtY: '23503',
      plantOfYUnderX: '23503',
    });
  });
});
