// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUIDv7 } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GqlAnswer, GqlClient } from './gql-client.ts';

/** What the suite reads of a register's definition from defineMasterData. */
export interface MasterDataRegister {
  /** The module's GraphQL name, such as core. */
  readonly module: string;
  /** The entity in PascalCase, such as EquipmentGroup. */
  readonly entity: string;
  readonly scopes: readonly string[];
}

/**
 * One company with two plants, A and B, and clients that send their requests at a plant: each
 * holds the role its name says where its name says.
 */
export interface MasterDataPlace {
  readonly plantA: string;
  readonly plantB: string;
  /** Company admin, at plant A. */
  readonly companyAdmin: GqlClient;
  /** Plant admin of plant A, at plant A. */
  readonly plantAdminA: GqlClient;
  /** Plant admin of plant B, at plant B. */
  readonly plantAdminB: GqlClient;
  /** A user who holds only the register's read permission at plant A, at plant A. */
  readonly readerA: GqlClient;
}

export interface MasterDataContractOptions {
  /** The story id that starts each test name, such as E06-S04. */
  readonly story: string;
  /** A fresh place for one test. */
  given(): Promise<MasterDataPlace>;
  /** The register's own fields that a create sends next to the kit's, such as {} for none. */
  readonly ownFields?: Readonly<Record<string, unknown>>;
}

/** A row as the suite selects it. */
interface Row {
  readonly id: string;
  readonly code: string;
  readonly version: number;
  readonly archivedAt: string | null;
}

/** The GraphQL code and errorCode of an answer's first error, or undefined for none. */
function refusal(answer: GqlAnswer) {
  const extensions = answer.errors?.[0]?.extensions;
  return extensions && { code: extensions.code, errorCode: extensions.errorCode };
}

const codeTaken = { code: 'CONFLICT', errorCode: 'core.code_taken' };
const forbidden = { code: 'FORBIDDEN', errorCode: 'core.forbidden' };

/**
 * The master-data kit's contract suite (ADR 0022), which every register runs once: create, the
 * code rule of ADR 0009 with its case and its scopes, archive, restore, the version check, the
 * permission check, and what each plant reads. A register at plant scope only skips the company
 * cases. Call it in the body of a describe of the register's tests, with an app that serves the
 * register's GraphQL fields.
 */
export function masterDataContract(
  register: MasterDataRegister,
  options: MasterDataContractOptions,
): void {
  const { module, entity, scopes } = register;
  const atCompany = scopes.includes('company');
  const field = `${module}${entity}`;
  const type = `${module[0]?.toUpperCase()}${module.slice(1)}`;
  const fields = `id code version archivedAt${atCompany ? ' scope' : ''}`;
  const mutation = (action: string) => `mutation ($input: ${type}${action}${entity}Input!) {
    ${module}${action}${entity}(input: $input) { ${fields} }
  }`;
  const list = `query ($includeArchived: Boolean) {
    ${field}s(includeArchived: $includeArchived) { totalCount edges { node { code } } }
  }`;
  const { story } = options;
  const own = options.ownFields ?? {};

  /** Sends a create of `code` at `scope`, as `client`. */
  async function create(client: GqlClient, code: string, scope: 'company' | 'plant' = 'plant') {
    const answer = await client.send(mutation('Create'), {
      input: {
        id: randomUUIDv7(),
        code,
        name: `${entity} ${code}`,
        ...own,
        ...(atCompany ? { scope } : {}),
      },
    });
    return { answer, row: answer.data?.[`${module}Create${entity}`] as Row | undefined };
  }

  /** The codes that `client` lists, by code. */
  async function codes(client: GqlClient, includeArchived = false) {
    const answer = await client.send<Record<string, { edges: { node: { code: string } }[] }>>(
      list,
      { includeArchived },
    );
    expect(answer.errors).toBeUndefined();
    return (answer.data?.[`${field}s`]?.edges ?? []).map(({ node }) => node.code);
  }

  describe(`the master-data contract of ${module}.${entity}`, () => {
    it(`${story} a Plant admin creates a row at the plant with version 1, which the plant lists by code`, async () => {
      const place = await options.given();

      const { answer, row } = await create(place.plantAdminA, ' M-2 ');
      await create(place.plantAdminA, 'M-1');

      expect(answer.errors).toBeUndefined();
      expect(row).toMatchObject({ code: 'M-2', version: 1, archivedAt: null });
      expect(await codes(place.plantAdminA)).toEqual(['M-1', 'M-2']);
    });

    it(`${story} a code that a row of the plant uses, in any case, is core.code_taken`, async () => {
      const place = await options.given();
      await create(place.plantAdminA, 'M-1');

      const { answer } = await create(place.plantAdminA, 'm-1');

      expect(refusal(answer)).toEqual(codeTaken);
    });

    it(`${story} plant B may use a code that plant A uses, and neither plant lists the other's row`, async () => {
      const place = await options.given();
      await create(place.plantAdminA, 'M-1');

      const { answer } = await create(place.plantAdminB, 'M-1');
      await create(place.plantAdminB, 'M-2');

      expect(answer.errors).toBeUndefined();
      expect(await codes(place.plantAdminA)).toEqual(['M-1']);
      expect(await codes(place.plantAdminB)).toEqual(['M-1', 'M-2']);
    });

    it(`${story} an archived row leaves the list unless includeArchived asks for it, keeps its code, and is restored`, async () => {
      const place = await options.given();
      const { row } = await create(place.plantAdminA, 'M-1');
      const archive = await place.plantAdminA.send(mutation('Archive'), {
        input: { id: row?.id, expectedVersion: 1 },
      });

      const hidden = await codes(place.plantAdminA);
      const shown = await codes(place.plantAdminA, true);
      const { answer: reused } = await create(place.plantAdminA, 'M-1');
      const restore = await place.plantAdminA.send(mutation('Restore'), {
        input: { id: row?.id, expectedVersion: 2 },
      });

      expect(archive.errors).toBeUndefined();
      expect(hidden).toEqual([]);
      expect(shown).toEqual(['M-1']);
      expect(refusal(reused)).toEqual(codeTaken);
      expect(restore.data?.[`${module}Restore${entity}`]).toMatchObject({
        version: 3,
        archivedAt: null,
      });
    });

    it(`${story} an update on a version the row has moved past is core.version_conflict, and an archived row is core.archived`, async () => {
      const place = await options.given();
      const { row } = await create(place.plantAdminA, 'M-1');
      const input = { id: row?.id, code: 'M-1', name: 'Renamed', ...own };
      const renamed = await place.plantAdminA.send(mutation('Update'), {
        input: { ...input, expectedVersion: 1 },
      });

      const stale = await place.plantAdminA.send(mutation('Update'), {
        input: { ...input, expectedVersion: 1 },
      });
      await place.plantAdminA.send(mutation('Archive'), {
        input: { id: row?.id, expectedVersion: 2 },
      });
      const archived = await place.plantAdminA.send(mutation('Update'), {
        input: { ...input, expectedVersion: 3 },
      });

      expect(renamed.data?.[`${module}Update${entity}`]).toMatchObject({ version: 2 });
      expect(refusal(stale)).toEqual({ code: 'CONFLICT', errorCode: 'core.version_conflict' });
      expect(refusal(archived)?.errorCode).toBe('core.archived');
    });

    it(`${story} a user with the read permission only may list, but not create, change or archive`, async () => {
      const place = await options.given();
      const { row } = await create(place.plantAdminA, 'M-1');

      const { answer: created } = await create(place.readerA, 'M-2');
      const archived = await place.readerA.send(mutation('Archive'), {
        input: { id: row?.id, expectedVersion: 1 },
      });

      expect(await codes(place.readerA)).toEqual(['M-1']);
      expect(refusal(created)).toEqual(forbidden);
      expect(refusal(archived)).toEqual(forbidden);
    });

    it(`${story} plant B cannot read, change or archive a row of plant A, which it finds as not there`, async () => {
      const place = await options.given();
      const { row } = await create(place.plantAdminA, 'M-1');

      const read = await place.plantAdminB.send(`query ($id: ID!) { ${field}(id: $id) { id } }`, {
        id: row?.id,
      });
      const archived = await place.plantAdminB.send(mutation('Archive'), {
        input: { id: row?.id, expectedVersion: 1 },
      });

      expect(read.data?.[field]).toBeNull();
      expect(archived.data ?? null).toBeNull();
      expect(refusal(archived)?.code).toBe('NOT_FOUND');
    });

    if (!atCompany) return;

    it(`${story} a Company admin creates a row at the company, which every plant lists next to its own`, async () => {
      const place = await options.given();

      const { answer, row } = await create(place.companyAdmin, 'C-1', 'company');
      await create(place.plantAdminA, 'A-1');
      await create(place.plantAdminB, 'B-1');

      expect(answer.errors).toBeUndefined();
      expect(row).toMatchObject({ code: 'C-1', scope: 'company' });
      expect(await codes(place.plantAdminA)).toEqual(['A-1', 'C-1']);
      expect(await codes(place.plantAdminB)).toEqual(['B-1', 'C-1']);
    });

    it(`${story} a Plant admin may not create, change or archive a row of the company`, async () => {
      const place = await options.given();
      const { row } = await create(place.companyAdmin, 'C-1', 'company');

      const { answer: created } = await create(place.plantAdminA, 'C-2', 'company');
      const archived = await place.plantAdminA.send(mutation('Archive'), {
        input: { id: row?.id, expectedVersion: 1 },
      });

      expect(refusal(created)).toEqual(forbidden);
      expect(refusal(archived)).toEqual(forbidden);
    });

    it(`${story} a plant code that the company uses is core.code_taken, and so is a company code that a plant uses`, async () => {
      const place = await options.given();
      await create(place.companyAdmin, 'C-1', 'company');
      await create(place.plantAdminB, 'B-1');

      const { answer: atPlant } = await create(place.plantAdminA, 'c-1');
      const { answer: atCompanyOfB } = await create(place.companyAdmin, 'b-1', 'company');

      expect(refusal(atPlant)).toEqual(codeTaken);
      expect(refusal(atCompanyOfB)).toEqual(codeTaken);
    });

    it(`${story} the refusal of a company code that another plant uses names neither that plant nor its row`, async () => {
      const place = await options.given();
      const { row } = await create(place.plantAdminB, 'B-1');

      const { answer } = await create(place.companyAdmin, 'B-1', 'company');
      const text = JSON.stringify(answer.errors);

      expect(refusal(answer)).toEqual(codeTaken);
      expect(text).not.toContain(place.plantB);
      expect(text).not.toContain(row?.id ?? 'no row');
    });
  });
}
