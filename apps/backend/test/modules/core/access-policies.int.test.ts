// SPDX-License-Identifier: AGPL-3.0-or-later
import { query, useTestDatabase } from '@northmes/testing';
import { describe, expect, it } from 'vitest';
import { givenCompany, givenUser } from '../../../src/testing.ts';

/**
 * Every module and in-process plugin writes as nm_app (ADR 0008), so the policies of core.role and
 * core.role_assignment keep a write outside the transaction's write scopes out, whoever sends it.
 */
describe('the row-level security policies of roles and role assignments', () => {
  const db = useTestDatabase();
  const principal = { type: 'user', id: 'e05-s06-policies' } as const;

  /** A company with one plant, a custom role of the company and a user who holds no role. */
  async function given() {
    const { company, plants } = await givenCompany(db.ownerUrl);
    const plant = plants[0] ?? '';
    const userId = await givenUser(db.ownerUrl, []);
    const roleId = await db.command(
      { principal, scopes: [company, plant], reason: 'E05-S06 fixture' },
      async (tx) => {
        const { rows } = await tx.query<{ id: string }>(
          `insert into core.role (company_id, key, name, permissions, origin)
           values ($1, 'shift-lead', 'Shift lead', '{core.article:read}', 'custom') returning id`,
          [company],
        );
        return rows[0]?.id ?? '';
      },
    );
    return { company, plant, userId, roleId };
  }

  /** Runs one statement as nm_app with these write scopes and answers what Postgres said. */
  async function asApp(scopes: readonly string[], sql: string, params: readonly unknown[]) {
    try {
      const count = await db.command(
        { principal, scopes, reason: 'E05-S06 probe' },
        async (tx) => (await tx.query(sql, [...params])).rowCount,
      );
      return { rows: count };
    } catch (error) {
      return { refused: (error as Error).message };
    }
  }

  it('E05-S06 nm_app writes a role only at a company among its write scopes', async () => {
    const { company, plant, roleId } = await given();

    const insert = await asApp(
      [plant],
      `insert into core.role (company_id, key, name, origin) values ($1, 'other', 'Other', 'custom')`,
      [company],
    );
    const update = await asApp(
      [plant],
      `update core.role set permissions = '{core.role:manage}' where id = $1`,
      [roleId],
    );
    const remove = await asApp([plant], 'delete from core.role where id = $1', [roleId]);
    const allowed = await asApp(
      [company, plant],
      `update core.role set name = 'Shift leader' where id = $1`,
      [roleId],
    );

    expect(insert).toEqual({
      refused: 'new row violates row-level security policy for table "role"',
    });
    expect(update).toEqual({ rows: 0 });
    expect(remove).toEqual({ rows: 0 });
    expect(allowed).toEqual({ rows: 1 });
  });

  it('E05-S06 nm_app assigns a role or removes an assignment only at a scope among its write scopes', async () => {
    const { company, plant, userId, roleId } = await given();
    const assign = (scopes: readonly string[], scopeId: string) =>
      asApp(
        scopes,
        `insert into core.role_assignment (user_id, company_id, scope_id, role_id)
         values ($1, $2, $3, $4)`,
        [userId, company, scopeId, roleId],
      );

    const atCompanyFromPlant = await assign([plant], company);
    const atPlant = await assign([plant], plant);
    const atCompany = await assign([company, plant], company);
    const removeFromPlant = await asApp(
      [plant],
      'delete from core.role_assignment where scope_id = $1',
      [company],
    );

    expect(atCompanyFromPlant).toEqual({
      refused: 'new row violates row-level security policy for table "role_assignment"',
    });
    expect(atPlant).toEqual({ rows: 1 });
    expect(atCompany).toEqual({ rows: 1 });
    expect(removeFromPlant).toEqual({ rows: 0 });
  });

  it("E05-S06 nm_app reads a role only with the role's company among its read scopes, so a role of another company is not readable", async () => {
    const acme = await given();
    const nordic = await given();
    const roleIds = [acme.roleId, nordic.roleId];

    const atAcme = await db.command(
      { principal, scopes: [acme.company, acme.plant], reason: 'E05-S06 probe' },
      async (tx) =>
        (await tx.query('select id from core.role where id = any ($1::uuid[])', [roleIds])).rows,
    );
    const withoutScopes = await query(
      db.appUrl,
      `select id from core.role where id in ('${acme.roleId}', '${nordic.roleId}')`,
    );

    expect(atAcme).toEqual([{ id: acme.roleId }]);
    expect(withoutScopes).toEqual([]);
  });

  it("E05-S06 nm_app reads a user's grants without scopes through core.principal_grants, a definer function with a pinned search_path", async () => {
    const { company, plant, userId, roleId } = await given();
    await asApp(
      [plant],
      `insert into core.role_assignment (user_id, company_id, scope_id, role_id)
       values ($1, $2, $3, $4)`,
      [userId, company, plant, roleId],
    );

    const grants = await query<{ id: string; parent_id: string | null; permissions: string[] }>(
      db.appUrl,
      `select id, parent_id, permissions from core.principal_grants('${userId}') order by parent_id nulls first`,
    );
    const [definer] = await query<{ prosecdef: boolean; proconfig: string[] }>(
      db.appUrl,
      `select prosecdef, proconfig from pg_proc where oid = 'core.principal_grants(uuid)'::regprocedure`,
    );

    expect(grants).toEqual([
      { id: company, parent_id: null, permissions: [] },
      { id: plant, parent_id: company, permissions: ['core.article:read'] },
    ]);
    expect(definer).toEqual({ prosecdef: true, proconfig: ['search_path=pg_catalog, pg_temp'] });
  });

  it('E05-S06 core.default_role has row-level security with one SELECT policy, so nm_app reads the default roles and writes none', async () => {
    const [table] = await query<{ relrowsecurity: boolean }>(
      db.appUrl,
      `select relrowsecurity from pg_class where oid = 'core.default_role'::regclass`,
    );
    const policies = await query<{ cmd: string; roles: string }>(
      db.appUrl,
      `select cmd, roles::text from pg_policies where schemaname = 'core' and tablename = 'default_role'`,
    );
    const keys = await query<{ key: string }>(
      db.appUrl,
      `select key from core.default_role where key = 'core-company-admin'`,
    );
    const insert = await asApp(
      [],
      `insert into core.default_role (key, module_id, name) values ('x-role', 'x', 'X')`,
      [],
    );

    expect(table).toEqual({ relrowsecurity: true });
    expect(policies).toEqual([{ cmd: 'SELECT', roles: '{nm_app}' }]);
    expect(keys).toEqual([{ key: 'core-company-admin' }]);
    expect(insert).toEqual({ refused: 'permission denied for table default_role' });
  });
});
