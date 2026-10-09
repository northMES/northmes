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

  it('E05-S06 nm_app still reads every role and assignment without scopes, as the principal query does', async () => {
    const { company, plant, userId, roleId } = await given();
    await asApp(
      [plant],
      `insert into core.role_assignment (user_id, company_id, scope_id, role_id)
       values ($1, $2, $3, $4)`,
      [userId, company, plant, roleId],
    );

    const rows = await query(
      db.appUrl,
      `select r.name, a.scope_id from core.role_assignment a join core.role r on r.id = a.role_id
        where a.user_id = '${userId}'`,
    );

    expect(rows).toEqual([{ name: 'Shift lead', scope_id: plant }]);
  });
});
