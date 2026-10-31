// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUIDv7 } from 'node:crypto';
import {
  givenAssignment,
  givenCompany,
  hostFactory,
  queryAsCore,
  signIn,
} from '@northmes/backend/testing';
import { equipmentGroups } from '@northmes/core-contracts';
import {
  createTestApp,
  type GqlClient,
  gqlClient,
  type MasterDataPlace,
  masterDataContract,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const createGroup = `mutation ($input: CoreCreateEquipmentGroupInput!) {
  coreCreateEquipmentGroup(input: $input) { id code scope color colorFrom version }
}`;

const updateGroup = `mutation ($input: CoreUpdateEquipmentGroupInput!) {
  coreUpdateEquipmentGroup(input: $input) { id color colorFrom version }
}`;

interface Group {
  readonly id: string;
  readonly code: string;
  readonly color: string;
  readonly colorFrom: string;
  readonly version: number;
}

describe('equipment groups', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /**
   * A client of a fresh user who holds the default role `key` at `scopeId`, at plant `slug`, or in
   * company settings without a slug.
   */
  async function holderOf(company: string, key: string, scopeId: string, slug?: string) {
    if (!testApp) throw new Error('the test app did not start');
    const user = await signIn(testApp.app, db.ownerUrl, []);
    const [role] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      'select id from core.role where company_id = $1 and key = $2',
      [company, key],
    );
    if (!role) throw new Error(`the company has no role ${key}`);
    await givenAssignment(db.ownerUrl, { userId: user.userId, roleId: role.id, scopeId });
    const headers: Record<string, string> = { authorization: user.authorization };
    if (slug !== undefined) headers['x-northmes-plant'] = slug;
    return gqlClient(await testApp.app.getUrl(), { headers });
  }

  /**
   * A company with plants A and B, their admins, its admin at plant A and in company settings, a
   * reader at plant A, and another company.
   */
  async function givenPlace(): Promise<MasterDataPlace> {
    if (!testApp) throw new Error('the test app did not start');
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, { plants: 2 });
    const other = await givenCompany(db.ownerUrl);
    const [plantA = '', plantB = ''] = plants;
    const [slugA = '', slugB = ''] = slugs;
    const reader = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plantA, permissions: ['core.equipmentGroup:read'] },
    ]);
    return {
      company,
      otherCompany: other.company,
      plantA,
      plantB,
      companyAdmin: await holderOf(company, 'core-company-admin', company, slugA),
      plantAdminA: await holderOf(company, 'core-plant-admin', plantA, slugA),
      plantAdminB: await holderOf(company, 'core-plant-admin', plantB, slugB),
      readerA: gqlClient(await testApp.app.getUrl(), {
        headers: { authorization: reader.authorization, 'x-northmes-plant': slugA },
      }),
      companySettings: await holderOf(company, 'core-company-admin', company),
    };
  }

  masterDataContract(equipmentGroups, { story: 'E06-S04', given: givenPlace });

  /** Creates group `code` at `scope` as `client`, with `color` when one is given. */
  async function create(
    client: GqlClient,
    code: string,
    { scope = 'plant', color }: { scope?: 'company' | 'plant'; color?: string } = {},
  ): Promise<Group | undefined> {
    const answer = await client.send(createGroup, {
      input: { id: randomUUIDv7(), code, name: `Group ${code}`, scope, color },
    });
    expect(answer.errors).toBeUndefined();
    return answer.data?.coreCreateEquipmentGroup as Group | undefined;
  }

  it('#729 a group created without a color takes the first palette color that no group the plant sees uses', async () => {
    const place = await givenPlace();
    await create(place.companyAdmin, 'ASM', { scope: 'company', color: 'palette-1' });
    await create(place.plantAdminA, 'TRN', { color: 'palette-3' });
    await create(place.plantAdminB, 'MIL', { color: 'palette-2' });

    const group = await create(place.plantAdminA, 'WLD');

    expect(group).toMatchObject({ color: 'palette-2', colorFrom: 'palette' });
  });

  it('#729 an archived group leaves its color free for the next group without one', async () => {
    const place = await givenPlace();
    await create(place.plantAdminA, 'ASM', { color: 'palette-1' });
    const old = await create(place.plantAdminA, 'OLD', { color: 'palette-2' });
    await place.plantAdminA.send(
      `mutation ($input: CoreArchiveEquipmentGroupInput!) {
        coreArchiveEquipmentGroup(input: $input) { id }
      }`,
      { input: { id: old?.id, expectedVersion: 1 } },
    );

    const group = await create(place.plantAdminA, 'WLD');

    expect(group).toMatchObject({ color: 'palette-2', colorFrom: 'palette' });
  });

  it('#729 a color given at create is set, and a new color at update is set too', async () => {
    const place = await givenPlace();
    const group = await create(place.plantAdminA, 'ASM', { color: 'palette-7' });

    const changed = await place.plantAdminA.send(updateGroup, {
      input: {
        id: group?.id,
        expectedVersion: 1,
        code: 'ASM',
        name: 'Assembly',
        color: 'palette-9',
      },
    });

    expect(group).toMatchObject({ color: 'palette-7', colorFrom: 'set' });
    expect(changed.data?.coreUpdateEquipmentGroup).toMatchObject({
      color: 'palette-9',
      colorFrom: 'set',
      version: 2,
    });
  });

  it('#729 an update without a color, or with the color the group has, keeps the color and where it came from', async () => {
    const place = await givenPlace();
    const group = await create(place.plantAdminA, 'ASM');
    const input = { id: group?.id, code: 'ASM', name: 'Assembly' };

    const without = await place.plantAdminA.send(updateGroup, {
      input: { ...input, expectedVersion: 1 },
    });
    const same = await place.plantAdminA.send(updateGroup, {
      input: { ...input, expectedVersion: 2, color: group?.color },
    });

    expect(group).toMatchObject({ color: 'palette-1', colorFrom: 'palette' });
    expect(without.data?.coreUpdateEquipmentGroup).toMatchObject({
      color: 'palette-1',
      colorFrom: 'palette',
    });
    expect(same.data?.coreUpdateEquipmentGroup).toMatchObject({
      color: 'palette-1',
      colorFrom: 'palette',
      version: 3,
    });
  });

  it('#729 a color outside the palette is refused on color', async () => {
    const place = await givenPlace();

    const answer = await place.plantAdminA.send(createGroup, {
      input: { id: randomUUIDv7(), code: 'ASM', name: 'Assembly', scope: 'plant', color: 'red' },
    });

    expect(answer.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: ['color'] }],
    });
  });
});
