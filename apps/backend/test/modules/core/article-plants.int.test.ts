// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import {
  type GivenCompany,
  givenArticle,
  givenAssignment,
  givenCompany,
  hostFactory,
  queryAsCore,
  signIn,
} from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrincipalService } from '../../../src/modules/core/core/access/principal.service.ts';
import { ArticleService } from '../../../src/modules/core/public-api.ts';
import { runAs } from '../../../src/principal.ts';

const articleFields = 'id code name version allPlants plants { slug name } archivedAt';

const createMutation = `mutation ($input: CoreCreateArticleInput!) {
  coreCreateArticle(input: $input) { ${articleFields} }
}`;

const updateMutation = `mutation ($input: CoreUpdateArticleInput!) {
  coreUpdateArticle(input: $input) { id version }
}`;

const archiveMutation = `mutation ($input: CoreArchiveArticleInput!) {
  coreArchiveArticle(input: $input) { id version }
}`;

const setPlantsMutation = `mutation ($input: CoreSetArticlePlantsInput!) {
  coreSetArticlePlants(input: $input) { ${articleFields} }
}`;

const listQuery = `query ($companyId: ID, $unassigned: Boolean) {
  coreArticles(companyId: $companyId, unassigned: $unassigned) { edges { node { code } } totalCount }
}`;

const articleQuery = `query ($id: ID!, $companyId: ID) {
  coreArticle(id: $id, companyId: $companyId) { ${articleFields} }
}`;

interface Article {
  id: string;
  code: string;
  name: string;
  version: number;
  allPlants: boolean;
  plants: { slug: string; name: string }[];
  archivedAt: string | null;
}

/** The GraphQL code and errorCode of each error of an answer. */
function refusals(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
  return answer.errors?.map(({ extensions }) => {
    const { code, errorCode } = extensions as Record<string, unknown>;
    return { code, errorCode };
  });
}

const forbidden = [{ code: 'FORBIDDEN', errorCode: 'core.forbidden' }];

describe('articles at the company, assigned to plants', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A company with the plants HEL and STO, by those names. */
  async function givenHelAndSto(): Promise<GivenCompany & { hel: string; sto: string }> {
    const company = await givenCompany(db.ownerUrl, { plantNames: ['HEL', 'STO'] });
    const [hel = '', sto = ''] = company.plants;
    return { ...company, hel, sto };
  }

  /**
   * A fresh signed-in user who holds the default role `key` of the company at `scopeId`, with a
   * client at the plant whose slug is `slug`, or without a plant.
   */
  async function holderOf(
    key: 'core-company-admin' | 'core-plant-admin',
    { company, scopeId, slug }: { company: string; scopeId: string; slug?: string },
  ): Promise<{ client: GqlClient; userId: string }> {
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
    return { client: gqlClient(await testApp.app.getUrl(), { headers }), userId: user.userId };
  }

  /** The codes that coreArticles lists for this client, with these arguments. */
  async function listed(client: GqlClient, variables: Record<string, unknown> = {}) {
    const answer = await client.send<{ coreArticles: { edges: { node: { code: string } }[] } }>(
      listQuery,
      variables,
    );
    expect(answer.errors).toBeUndefined();
    return answer.data?.coreArticles.edges.map(({ node }) => node.code);
  }

  /** A code no other test uses. */
  const code = (prefix: string) => `${prefix}-${randomBytes(3).toString('hex')}`;

  it('ADR0073-W2 a Plant admin at HEL creates an article that is assigned to HEL, listed at HEL and not listed at STO', async () => {
    const place = await givenHelAndSto();
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const helAdmin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.hel,
      slug: helSlug,
    });
    const companyAdminAtSto = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
      slug: stoSlug,
    });
    const id = randomUUIDv7();

    const created = await helAdmin.client.send<{ coreCreateArticle: Article }>(createMutation, {
      input: { id, code: 'BR-140', name: 'Wall bracket' },
    });

    expect(created.errors).toBeUndefined();
    expect(created.data?.coreCreateArticle).toMatchObject({
      id,
      version: 1,
      allPlants: false,
      plants: [{ slug: helSlug, name: 'HEL' }],
    });
    expect(await listed(helAdmin.client)).toEqual(['BR-140']);
    expect(await listed(companyAdminAtSto.client)).toEqual([]);
  });

  it('ADR0073-W2 a Plant admin at HEL gets core.forbidden creating an article with plants HEL and STO', async () => {
    const place = await givenHelAndSto();
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const helAdmin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.hel,
      slug: helSlug,
    });

    const answer = await helAdmin.client.send(createMutation, {
      input: {
        id: randomUUIDv7(),
        code: 'BR-141',
        name: 'Wall bracket',
        plants: [helSlug, stoSlug],
      },
    });

    expect(refusals(answer)).toEqual(forbidden);
    expect(await listed(helAdmin.client)).toEqual([]);
  });

  it('ADR0073-W2 a Company admin creates an article for All plants, and it is listed at a plant created after it', async () => {
    const place = await givenHelAndSto();
    const [helSlug = ''] = place.slugs;
    const admin = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
      slug: helSlug,
    });
    const created = await admin.client.send<{ coreCreateArticle: Article }>(createMutation, {
      input: { id: randomUUIDv7(), code: 'CW-220', name: 'Caster wheel', allPlants: true },
    });
    expect(created.data?.coreCreateArticle).toMatchObject({ allPlants: true, plants: [] });
    const osl = randomUUIDv7();
    const oslSlug = `plant-${randomBytes(5).toString('hex')}`;
    await queryAsCore(
      db.ownerUrl,
      `with node as (
         insert into core.scope (id, company_id, parent_id, kind, span)
         values ($1, $2, $2, 'plant', int8range(3::int8 << 32, 4::int8 << 32)) returning id
       )
       insert into core.plant (id, company_id, slug, name) select id, $2, $3, 'OSL' from node`,
      [osl, place.company, oslSlug],
    );
    const atOsl = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
      slug: oslSlug,
    });

    expect(await listed(atOsl.client)).toEqual(['CW-220']);
  });

  it('ADR0073-W2 a Company admin assigns a HEL article to STO, which bumps its version, and STO then lists it', async () => {
    const place = await givenHelAndSto();
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const id = await givenArticle(db.ownerUrl, {
      code: 'HG-110',
      name: 'Cabinet hinge',
      plants: [place.hel],
    });
    const admin = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
      slug: stoSlug,
    });
    expect(await listed(admin.client)).toEqual([]);

    const answer = await admin.client.send<{ coreSetArticlePlants: Article }>(setPlantsMutation, {
      input: { id, expectedVersion: 1, allPlants: false, plants: [helSlug, stoSlug] },
    });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreSetArticlePlants).toMatchObject({
      version: 2,
      allPlants: false,
      plants: [
        { slug: helSlug, name: 'HEL' },
        { slug: stoSlug, name: 'STO' },
      ],
    });
    expect(await listed(admin.client)).toEqual(['HG-110']);
  });

  it('ADR0073-W2 an unassigned article is listed only without a plant, and with unassigned true only it', async () => {
    const place = await givenHelAndSto();
    const [helSlug = ''] = place.slugs;
    await givenArticle(db.ownerUrl, {
      code: 'SH-210',
      name: 'Shelf board',
      company: place.company,
    });
    await givenArticle(db.ownerUrl, { code: 'SH-211', name: 'Shelf board', plants: [place.hel] });
    const atHel = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
      slug: helSlug,
    });
    const inSettings = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
    });

    expect(await listed(atHel.client)).toEqual(['SH-211']);
    expect(await listed(inSettings.client, { companyId: place.company })).toEqual([
      'SH-210',
      'SH-211',
    ]);
    expect(await listed(inSettings.client, { companyId: place.company, unassigned: true })).toEqual(
      ['SH-210'],
    );
  });

  it('ADR0073-W2 a Plant admin at HEL updates and archives an article assigned only to HEL, and gets core.forbidden for one assigned to HEL and STO or to All plants', async () => {
    const place = await givenHelAndSto();
    const [helSlug = ''] = place.slugs;
    const helAdmin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.hel,
      slug: helSlug,
    });
    const own = await givenArticle(db.ownerUrl, {
      code: 'LG-712',
      name: 'Leg',
      plants: [place.hel],
    });
    const shared = await givenArticle(db.ownerUrl, {
      code: 'LG-713',
      name: 'Leg',
      plants: [place.hel, place.sto],
    });
    const everywhere = await givenArticle(db.ownerUrl, {
      code: 'LG-714',
      name: 'Leg',
      company: place.company,
      allPlants: true,
    });
    const update = (id: string) =>
      helAdmin.client.send(updateMutation, {
        input: { id, expectedVersion: 1, code: code('LG'), name: 'Table leg' },
      });
    const archive = (id: string, expectedVersion: number) =>
      helAdmin.client.send(archiveMutation, { input: { id, expectedVersion } });

    expect((await update(own)).errors).toBeUndefined();
    expect((await archive(own, 2)).errors).toBeUndefined();
    expect(refusals(await update(shared))).toEqual(forbidden);
    expect(refusals(await archive(shared, 1))).toEqual(forbidden);
    expect(refusals(await update(everywhere))).toEqual(forbidden);
    expect(refusals(await archive(everywhere, 1))).toEqual(forbidden);
  });

  it('ADR0073-W2 a Plant admin at HEL and STO gets core.forbidden changing an article of STO alone from a request at HEL, and the article keeps its version', async () => {
    const place = await givenHelAndSto();
    const [helSlug = ''] = place.slugs;
    const admin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.hel,
      slug: helSlug,
    });
    const [role] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      "select id from core.role where company_id = $1 and key = 'core-plant-admin'",
      [place.company],
    );
    await givenAssignment(db.ownerUrl, {
      userId: admin.userId,
      roleId: role?.id ?? '',
      scopeId: place.sto,
    });
    const id = await givenArticle(db.ownerUrl, { code: 'ST-1', name: 'Stud', plants: [place.sto] });

    const updated = await admin.client.send(updateMutation, {
      input: { id, expectedVersion: 1, code: 'ST-1', name: 'Renamed' },
    });
    const archived = await admin.client.send(archiveMutation, {
      input: { id, expectedVersion: 1 },
    });

    expect(refusals(updated)).toEqual(forbidden);
    expect(refusals(archived)).toEqual(forbidden);
    const read = await admin.client.send<{ coreArticle: Article | null }>(articleQuery, { id });
    expect(read.data?.coreArticle).toMatchObject({ name: 'Stud', version: 1, archivedAt: null });
  });

  it('ADR0073-W2 a Company admin in company settings creates an unassigned article and one for HEL, and changes their plants and names without a plant', async () => {
    const place = await givenHelAndSto();
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const inSettings = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
    });
    const atHel = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
      slug: helSlug,
    });
    const loose = randomUUIDv7();

    const unassigned = await inSettings.client.send<{ coreCreateArticle: Article }>(
      createMutation,
      { input: { id: loose, code: 'CS-1', name: 'Clamp', companyId: place.company } },
    );
    const forHel = await inSettings.client.send<{ coreCreateArticle: Article }>(createMutation, {
      input: {
        id: randomUUIDv7(),
        code: 'CS-2',
        name: 'Clamp',
        companyId: place.company,
        plants: [helSlug],
      },
    });

    expect(unassigned.errors).toBeUndefined();
    expect(unassigned.data?.coreCreateArticle).toMatchObject({ allPlants: false, plants: [] });
    expect(forHel.errors).toBeUndefined();
    expect(forHel.data?.coreCreateArticle).toMatchObject({ plants: [{ slug: helSlug }] });
    expect(await listed(inSettings.client, { companyId: place.company, unassigned: true })).toEqual(
      ['CS-1'],
    );
    expect(await listed(atHel.client)).toEqual(['CS-2']);

    const assigned = await inSettings.client.send<{ coreSetArticlePlants: Article }>(
      setPlantsMutation,
      { input: { id: loose, expectedVersion: 1, allPlants: false, plants: [stoSlug] } },
    );
    const renamed = await inSettings.client.send(updateMutation, {
      input: { id: loose, expectedVersion: 2, code: 'CS-1', name: 'Bar clamp' },
    });

    expect(assigned.errors).toBeUndefined();
    expect(assigned.data?.coreSetArticlePlants).toMatchObject({ plants: [{ slug: stoSlug }] });
    expect(renamed.errors).toBeUndefined();
  });

  it('ADR0073-W2 a Plant admin in company settings gets core.forbidden creating an article', async () => {
    const place = await givenHelAndSto();
    const helAdmin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.hel,
    });

    const answer = await helAdmin.client.send(createMutation, {
      input: { id: randomUUIDv7(), code: 'CS-3', name: 'Clamp', companyId: place.company },
    });

    expect(refusals(answer)).toEqual(forbidden);
  });

  it("ADR0073-W2 a Plant admin gets core.forbidden setting the plants of an article that only the admin's plant uses", async () => {
    const place = await givenHelAndSto();
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const helAdmin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.hel,
      slug: helSlug,
    });
    const id = await givenArticle(db.ownerUrl, {
      code: 'KN-001',
      name: 'Knob',
      plants: [place.hel],
    });

    const answer = await helAdmin.client.send(setPlantsMutation, {
      input: { id, expectedVersion: 1, allPlants: false, plants: [helSlug, stoSlug] },
    });

    expect(refusals(answer)).toEqual(forbidden);
  });

  it('ADR0073-W2 a Plant admin at STO gets core.code_taken creating a code that an article assigned only to HEL uses', async () => {
    const place = await givenHelAndSto();
    const [, stoSlug = ''] = place.slugs;
    await givenArticle(db.ownerUrl, { code: 'DR-500', name: 'Drawer', plants: [place.hel] });
    const stoAdmin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.sto,
      slug: stoSlug,
    });

    const answer = await stoAdmin.client.send(createMutation, {
      input: { id: randomUUIDv7(), code: 'dr-500', name: 'Drawer' },
    });

    expect(refusals(answer)).toEqual([{ code: 'CONFLICT', errorCode: 'core.code_taken' }]);
  });

  it('ADR0073-W2 a create with All plants and a list of plants, or with a slug that names no plant of the company, returns BAD_USER_INPUT on plants', async () => {
    const place = await givenHelAndSto();
    const [helSlug = ''] = place.slugs;
    const admin = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
      slug: helSlug,
    });
    const other = await givenCompany(db.ownerUrl);

    const both = await admin.client.send(createMutation, {
      input: {
        id: randomUUIDv7(),
        code: 'PL-1',
        name: 'Plate',
        allPlants: true,
        plants: [helSlug],
      },
    });
    const unknown = await admin.client.send(createMutation, {
      input: { id: randomUUIDv7(), code: 'PL-2', name: 'Plate', plants: [other.slugs[0]] },
    });

    expect(both.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: ['plants'] }],
    });
    expect(unknown.errors?.[0]?.extensions).toMatchObject({
      code: 'BAD_USER_INPUT',
      fieldErrors: [{ path: ['plants', 0] }],
    });
    expect(await listed(admin.client)).toEqual([]);
  });

  it('ADR0073-W2 a read by id at STO returns an article of the company that is not assigned to STO', async () => {
    const place = await givenHelAndSto();
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const id = await givenArticle(db.ownerUrl, {
      code: 'SC-10',
      name: 'Screw',
      plants: [place.hel],
    });
    const stoAdmin = await holderOf('core-plant-admin', {
      company: place.company,
      scopeId: place.sto,
      slug: stoSlug,
    });

    const answer = await stoAdmin.client.send<{ coreArticle: Article | null }>(articleQuery, {
      id,
    });

    expect(answer.data?.coreArticle).toMatchObject({ code: 'SC-10', plants: [{ slug: helSlug }] });
  });

  it('ADR0073-W2 after HEL is removed from an article, a HEL order that references it keeps it, and a new reference at HEL fails with core.article_not_assigned', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const place = await givenHelAndSto();
    const [helSlug = '', stoSlug = ''] = place.slugs;
    const id = await givenArticle(db.ownerUrl, {
      code: 'WH-30',
      name: 'Wheel',
      plants: [place.hel, place.sto],
    });
    await db.command(
      { principal: { type: 'system', id: 'fixture' }, scopes: [place.hel], reason: 'fixture' },
      (tx) =>
        tx.query(
          `insert into planning.production_order (scope_id, number, article_id, quantity)
           values ($1, '7001', $2, 10)`,
          [place.hel, id],
        ),
    );
    const admin = await holderOf('core-company-admin', {
      company: place.company,
      scopeId: place.company,
      slug: helSlug,
    });

    const removed = await admin.client.send(setPlantsMutation, {
      input: { id, expectedVersion: 1, allPlants: false, plants: [stoSlug] },
    });

    expect(removed.errors).toBeUndefined();
    const orders = await admin.client.send(
      '{ planningProductionOrders { number article { code } } }',
    );
    expect(orders.data).toEqual({
      planningProductionOrders: [{ number: '7001', article: { code: 'WH-30' } }],
    });
    const articles = testApp.app.get(ArticleService);
    const principals = testApp.app.get(PrincipalService);
    const atHel = await principals.forUser(admin.userId, helSlug);
    const atSto = await principals.forUser(admin.userId, stoSlug);
    await expect(runAs(atHel, () => articles.requireAssigned(id))).rejects.toMatchObject({
      code: 'core.article_not_assigned',
    });
    await expect(runAs(atSto, () => articles.requireAssigned(id))).resolves.toBeUndefined();
  });

  it('ADR0073-W2 as nm_app with read scopes {company, HEL} and write scopes {HEL}, an update of an article whose edit scope is the company affects 0 rows, and of one whose edit scope is HEL affects 1', async () => {
    const place = await givenHelAndSto();
    const shared = await givenArticle(db.ownerUrl, {
      code: 'RL-1',
      name: 'Rail',
      plants: [place.hel, place.sto],
    });
    const own = await givenArticle(db.ownerUrl, {
      code: 'RL-2',
      name: 'Rail',
      plants: [place.hel],
    });
    const context = {
      principal: { type: 'system', id: 'fixture' },
      scopes: [place.hel],
      reason: 'fixture',
    } as const;

    // A request at HEL reads HEL and its company and writes HEL (ADR 0008).
    const rename = (id: string) =>
      db.command(context, async (tx) => {
        await tx.query("select set_config('northmes.read_scopes', $1::uuid[]::text, true)", [
          [place.company, place.hel],
        ]);
        return tx.query("update core.article set name = 'Renamed' where id = $1", [id]);
      });

    expect((await rename(shared)).rowCount).toBe(0);
    expect((await rename(own)).rowCount).toBe(1);
  });
});
