// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUIDv7 } from 'node:crypto';
import { hostFactory } from '@northmes/backend/testing';
import { equipment } from '@northmes/core-contracts';
import {
  createTestApp,
  type GqlAnswer,
  type GqlClient,
  type MasterDataPlace,
  masterDataContract,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { givenMasterDataPlace } from '../../fixtures/master-data-place.ts';

const createGroup = `mutation ($input: CoreCreateEquipmentGroupInput!) {
  coreCreateEquipmentGroup(input: $input) { id }
}`;

const archiveGroup = `mutation ($input: CoreArchiveEquipmentGroupInput!) {
  coreArchiveEquipmentGroup(input: $input) { id }
}`;

const machineFields = 'id code groupId isPlannable isOee color version';

const createMachine = `mutation ($input: CoreCreateEquipmentInput!) {
  coreCreateEquipment(input: $input) { ${machineFields} }
}`;

const updateMachine = `mutation ($input: CoreUpdateEquipmentInput!) {
  coreUpdateEquipment(input: $input) { ${machineFields} }
}`;

const listMachines = `query ($groupId: ID, $isPlannable: Boolean, $onBoard: Boolean) {
  coreEquipmentList(groupId: $groupId, isPlannable: $isPlannable, onBoard: $onBoard) {
    totalCount edges { node { code group { code archivedAt } } }
  }
}`;

interface Machine {
  readonly id: string;
  readonly code: string;
  readonly groupId: string;
  readonly isPlannable: boolean;
  readonly isOee: boolean;
  readonly color: string | null;
  readonly version: number;
}

interface Listed {
  readonly coreEquipmentList: {
    readonly edges: {
      readonly node: {
        readonly code: string;
        readonly group: { readonly code: string; readonly archivedAt: string | null } | null;
      };
    }[];
  };
}

/** The GraphQL code and errorCode of an answer's first error, with its field paths. */
function refusal(answer: GqlAnswer) {
  const extensions = answer.errors?.[0]?.extensions;
  return {
    code: extensions?.code,
    errorCode: extensions?.errorCode,
    paths: (extensions?.fieldErrors as { path: string[] }[] | undefined)?.map(({ path }) => path),
  };
}

describe('equipment', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** The place of the contract suite, whose reader holds core.equipment:read. */
  function givenPlace(): Promise<MasterDataPlace> {
    return givenMasterDataPlace(testApp, db.ownerUrl, 'core.equipment:read');
  }

  /** Creates group `code` as `client` at `scope`, and answers its id. */
  async function group(
    client: GqlClient,
    code: string,
    scope: 'company' | 'plant' = 'plant',
  ): Promise<string> {
    const answer = await client.send<{ coreCreateEquipmentGroup: { id: string } }>(createGroup, {
      input: { id: randomUUIDv7(), code, name: `Group ${code}`, scope },
    });
    expect(answer.errors).toBeUndefined();
    return answer.data?.coreCreateEquipmentGroup.id ?? '';
  }

  masterDataContract(equipment, {
    story: 'E06-S05',
    given: givenPlace,
    // Every machine belongs to a group: one of the company, which both plants see.
    ownFields: async (place) => ({ groupId: await group(place.companyAdmin, 'ALL', 'company') }),
  });

  /** Sends a create of machine `code` in group `groupId` as `client`, with `fields` besides. */
  function sendCreate(
    client: GqlClient,
    code: string,
    groupId: string,
    fields: Readonly<Record<string, unknown>> = {},
  ) {
    return client.send<{ coreCreateEquipment: Machine }>(createMachine, {
      input: { id: randomUUIDv7(), code, name: `Machine ${code}`, groupId, ...fields },
    });
  }

  /** Creates machine `code` as `client`, and answers it. */
  async function machine(
    client: GqlClient,
    code: string,
    groupId: string,
    fields: Readonly<Record<string, unknown>> = {},
  ): Promise<Machine> {
    const answer = await sendCreate(client, code, groupId, fields);
    expect(answer.errors).toBeUndefined();
    return answer.data?.coreCreateEquipment as Machine;
  }

  /** The codes of the machines that `client` lists with `filters`. */
  async function listed(client: GqlClient, filters: Readonly<Record<string, unknown>> = {}) {
    const answer = await client.send<Listed>(listMachines, filters);
    expect(answer.errors).toBeUndefined();
    return (answer.data?.coreEquipmentList.edges ?? []).map(({ node }) => node.code);
  }

  it("#67 non-plannable equipment is not in the board's equipment list", async () => {
    const place = await givenPlace();
    const assembly = await group(place.plantAdminA, 'ASM');
    await machine(place.plantAdminA, 'M-1', assembly);
    await machine(place.plantAdminA, 'M-2', assembly, { isPlannable: false, isOee: true });
    await machine(place.plantAdminA, 'M-3', assembly, { isPlannable: false });

    expect(await listed(place.plantAdminA, { onBoard: true })).toEqual(['M-1', 'M-2']);
    expect(await listed(place.plantAdminA, { onBoard: false })).toEqual(['M-3']);
  });

  it('#67 a machine is plannable, not OEE-measured and takes its stripe from its group unless the create says otherwise', async () => {
    const place = await givenPlace();
    const assembly = await group(place.plantAdminA, 'ASM');

    const plain = await machine(place.plantAdminA, 'M-1', assembly);
    const own = await machine(place.plantAdminA, 'M-2', assembly, {
      isPlannable: false,
      isOee: true,
      color: 'palette-4',
    });

    expect(plain).toMatchObject({ groupId: assembly, isPlannable: true, isOee: false, color: null });
    expect(own).toMatchObject({ isPlannable: false, isOee: true, color: 'palette-4' });
  });

  it('#67 an update without the flags or the color keeps them, and a null color returns the stripe to the group', async () => {
    const place = await givenPlace();
    const assembly = await group(place.plantAdminA, 'ASM');
    const created = await machine(place.plantAdminA, 'M-1', assembly, {
      isPlannable: false,
      isOee: true,
      color: 'palette-4',
    });
    const input = { id: created.id, code: 'M-1', name: 'Lathe', groupId: assembly };

    const kept = await place.plantAdminA.send<{ coreUpdateEquipment: Machine }>(updateMachine, {
      input: { ...input, expectedVersion: 1 },
    });
    const cleared = await place.plantAdminA.send<{ coreUpdateEquipment: Machine }>(updateMachine, {
      input: { ...input, expectedVersion: 2, color: null },
    });

    expect(kept.data?.coreUpdateEquipment).toMatchObject({
      isPlannable: false,
      isOee: true,
      color: 'palette-4',
    });
    expect(cleared.data?.coreUpdateEquipment).toMatchObject({ color: null, version: 3 });
  });

  it('#965 the list filters by group and by isPlannable', async () => {
    const place = await givenPlace();
    const assembly = await group(place.plantAdminA, 'ASM');
    const turning = await group(place.plantAdminA, 'TRN');
    await machine(place.plantAdminA, 'M-1', assembly);
    await machine(place.plantAdminA, 'M-2', turning, { isPlannable: false });
    await machine(place.plantAdminA, 'M-3', turning);

    expect(await listed(place.plantAdminA, { groupId: turning })).toEqual(['M-2', 'M-3']);
    expect(await listed(place.plantAdminA, { isPlannable: false })).toEqual(['M-2']);
  });

  it("#965 each machine in the list answers its group, the company's or its plant's", async () => {
    const place = await givenPlace();
    const company = await group(place.companyAdmin, 'ALL', 'company');
    const assembly = await group(place.plantAdminA, 'ASM');
    await machine(place.plantAdminA, 'M-1', company);
    await machine(place.plantAdminA, 'M-2', assembly);

    const answer = await place.plantAdminA.send<Listed>(listMachines, {});

    expect(answer.data?.coreEquipmentList.edges.map(({ node }) => node.group?.code)).toEqual([
      'ALL',
      'ASM',
    ]);
  });

  it('#965 a group of another plant is core.crossScopeReference on groupId, and so is a group id nobody uses', async () => {
    const place = await givenPlace();
    const atB = await group(place.plantAdminB, 'TRN');
    const assembly = await group(place.plantAdminA, 'ASM');
    const created = await machine(place.plantAdminA, 'M-1', assembly);

    const other = await sendCreate(place.companyAdmin, 'M-2', atB);
    const unknown = await sendCreate(place.plantAdminA, 'M-3', randomUUIDv7());
    const moved = await place.plantAdminA.send(updateMachine, {
      input: { id: created.id, expectedVersion: 1, code: 'M-1', name: 'Lathe', groupId: atB },
    });

    const crossScope = {
      code: 'BAD_USER_INPUT',
      errorCode: 'core.crossScopeReference',
      paths: [['groupId']],
    };
    expect([other, unknown, moved].map(refusal)).toEqual([crossScope, crossScope, crossScope]);
    expect(JSON.stringify(other.errors)).not.toContain(place.plantB);
  });

  it('#965 archiving a group keeps its machines in it, and an archived group takes no new machine', async () => {
    const place = await givenPlace();
    const assembly = await group(place.plantAdminA, 'ASM');
    const created = await machine(place.plantAdminA, 'M-1', assembly);
    await place.plantAdminA.send(archiveGroup, { input: { id: assembly, expectedVersion: 1 } });

    const answer = await place.plantAdminA.send<Listed>(listMachines, {});
    const renamed = await place.plantAdminA.send(updateMachine, {
      input: { id: created.id, expectedVersion: 1, code: 'M-1', name: 'Lathe', groupId: assembly },
    });
    const added = await sendCreate(place.plantAdminA, 'M-2', assembly);

    expect(answer.data?.coreEquipmentList.edges[0]?.node.group).toMatchObject({ code: 'ASM' });
    expect(answer.data?.coreEquipmentList.edges[0]?.node.group?.archivedAt).not.toBeNull();
    expect(renamed.errors).toBeUndefined();
    expect(refusal(added)).toEqual({
      code: 'BAD_USER_INPUT',
      errorCode: 'core.archived',
      paths: [['groupId']],
    });
  });
});
