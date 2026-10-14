// SPDX-License-Identifier: AGPL-3.0-or-later
import { useTestDatabase } from '@northmes/testing';
import { describe, expect, it } from 'vitest';
import { givenCompany, givenUser } from '../../../src/testing.ts';

/**
 * A user's own dashboard tab belongs to that user, so the policies of core.dashboard_tab read
 * northmes.user_id beside the scope sets (ADR 0078). Every module and plugin reads as nm_app, so
 * the database, not a filter in core, keeps one user's own tabs from every other user.
 */
describe('the row-level security policies of dashboard tabs', () => {
  const db = useTestDatabase();
  const principal = { type: 'user', id: 'dashboard-policies' } as const;

  /** A company with two plants, two users, and a tab of each kind. */
  async function given() {
    const { company, plants } = await givenCompany(db.ownerUrl, { plants: 2 });
    const [plant = '', sibling = ''] = plants;
    const alex = await givenUser(db.ownerUrl, []);
    const jonas = await givenUser(db.ownerUrl, []);
    const insert = (scopeId: string, ownerId: string | null, name: string, userId = '') =>
      db.command(
        { principal, scopes: [company, plant, sibling], reason: 'fixture', userId },
        async (tx) => {
          const { rows } = await tx.query<{ id: string }>(
            `insert into core.dashboard_tab (scope_id, company_id, owner_id, name, position)
             values ($1, $2, $3, $4, 0) returning id`,
            [scopeId, company, ownerId, name],
          );
          return rows[0]?.id ?? '';
        },
      );
    const ids = {
      companyTab: await insert(company, null, 'Company overview'),
      plantTab: await insert(plant, null, 'Shift overview'),
      siblingTab: await insert(sibling, null, 'Press line'),
      alexTab: await insert(company, alex, 'My shift', alex),
      jonasTab: await insert(company, jonas, 'Jonas notes', jonas),
    };
    return { company, plant, sibling, alex, jonas, ...ids };
  }

  /** The names of the tabs a transaction with these settings reads, sorted. */
  async function names(scopes: readonly string[], userId = ''): Promise<string[]> {
    const rows = await db.command({ principal, scopes, reason: 'probe', userId }, async (tx) => {
      const { rows } = await tx.query<{ name: string }>('select name from core.dashboard_tab');
      return rows;
    });
    return rows.map(({ name }) => name).sort();
  }

  /** Runs one statement as nm_app and answers its row count, or the SQLSTATE Postgres refused with. */
  async function asApp(
    context: { scopes: readonly string[]; writeScopes?: readonly string[]; userId?: string },
    statement: string,
    params: readonly unknown[],
  ): Promise<{ rows: number | null } | { code: string }> {
    try {
      const rows = await db.command(
        { principal, reason: 'probe', ...context },
        async (tx) => (await tx.query(statement, [...params])).rowCount,
      );
      return { rows };
    } catch (error) {
      return { code: (error as { code?: string }).code ?? String(error) };
    }
  }

  it('reads the shared tabs of its scopes and only its own user’s own tabs', async () => {
    const { company, plant, alex } = await given();

    expect(await names([company, plant], alex)).toEqual([
      'Company overview',
      'My shift',
      'Shift overview',
    ]);
  });

  it('reads no own tab without a user', async () => {
    const { company, plant } = await given();

    expect(await names([company, plant])).toEqual(['Company overview', 'Shift overview']);
  });

  it('reads no own tab outside its read scopes, and no tab of a sibling plant', async () => {
    const { plant, alex } = await given();

    expect(await names([plant], alex)).toEqual(['Shift overview']);
  });

  it('may not change or delete another user’s own tab', async () => {
    const { company, plant, alex, jonasTab } = await given();
    const context = { scopes: [company, plant], userId: alex };

    expect(
      await asApp(context, `update core.dashboard_tab set name = 'Mine' where id = $1`, [jonasTab]),
    ).toEqual({ rows: 0 });
    expect(
      await asApp(context, 'delete from core.dashboard_tab where id = $1', [jonasTab]),
    ).toEqual({ rows: 0 });
  });

  it('may not write an own tab for another user', async () => {
    const { company, plant, alex, jonas } = await given();

    expect(
      await asApp(
        { scopes: [company, plant], userId: alex },
        `insert into core.dashboard_tab (scope_id, company_id, owner_id, name, position)
         values ($1, $1, $2, 'Planted', 0)`,
        [company, jonas],
      ),
    ).toEqual({ code: '42501' });
  });

  it('lets a user without write scopes keep own tabs, but not shared ones', async () => {
    const { company, plant, alex, alexTab, plantTab } = await given();
    const viewer = { scopes: [company, plant], writeScopes: [], userId: alex };

    expect(
      await asApp(viewer, `update core.dashboard_tab set name = 'Mine' where id = $1`, [alexTab]),
    ).toEqual({ rows: 1 });
    expect(
      await asApp(viewer, `update core.dashboard_tab set name = 'Ours' where id = $1`, [plantTab]),
    ).toEqual({ rows: 0 });
    expect(
      await asApp(
        viewer,
        `insert into core.dashboard_tab (scope_id, company_id, name, position)
         values ($1, $2, 'Shared', 0)`,
        [plant, company],
      ),
    ).toEqual({ code: '42501' });
  });

  it('keeps an own tab at its owner’s company', async () => {
    const { company, plant, alex } = await given();

    expect(
      await asApp(
        { scopes: [company, plant], userId: alex },
        `insert into core.dashboard_tab (scope_id, company_id, owner_id, name, position)
         values ($1, $2, $3, 'At the plant', 0)`,
        [plant, company, alex],
      ),
    ).toEqual({ code: '23514' });
  });
});
