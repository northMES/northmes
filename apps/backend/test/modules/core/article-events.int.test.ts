// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { hostFactory, queryAsCore, signInAt } from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  given,
  gqlClient,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const fields = 'id code name version';

const createMutation = `mutation ($input: CoreCreateArticleInput!) {
  coreCreateArticle(input: $input) { ${fields} }
}`;

const updateMutation = `mutation ($input: CoreUpdateArticleInput!) {
  coreUpdateArticle(input: $input) { ${fields} }
}`;

const archiveMutation = `mutation ($input: CoreArchiveArticleInput!) {
  coreArchiveArticle(input: $input) { ${fields} }
}`;

const upsertMutation = `mutation ($input: CoreUpsertArticleInput!) {
  coreUpsertArticle(input: $input) { ${fields} }
}`;

const restoreMutation = `mutation ($input: CoreRestoreArticleInput!) {
  coreRestoreArticle(input: $input) { ${fields} }
}`;

interface EventRow extends Record<string, unknown> {
  event: string;
  schema_version: number;
  entity_type: string;
  entity_id: string;
  entity_version: string;
  scope_id: string;
  data: unknown;
  context: { actor: string; command: string };
}

/**
 * core's article commands write their event to core.event in the command's transaction, so an
 * event exists exactly when its command commits (ADR 0014). Plugins such as the article log
 * example consume them.
 */
describe('the events of core’s article commands', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  async function clientAt(plant: string): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    const headers = await signInAt(testApp.app, db.ownerUrl, plant);
    return gqlClient(await testApp.app.getUrl(), { headers });
  }

  /** The events of the article with `id`, in the order they were written. */
  function eventsOf(id: string): Promise<EventRow[]> {
    return queryAsCore<EventRow>(
      db.ownerUrl,
      `select event, schema_version, entity_type, entity_id, entity_version::text, scope_id,
              data, context
         from core.event where entity_id = $1 order by seq`,
      [id],
    );
  }

  /** An article's edit scope, where its commands run and the scope its events carry. */
  async function editScopeOf(id: string): Promise<string> {
    const [row] = await queryAsCore<{ scope_id: string }>(
      db.ownerUrl,
      'select edit_scope_id as scope_id from core.article where id = $1',
      [id],
    );
    return row?.scope_id ?? '';
  }

  it('E05-S09 coreCreateArticle writes one core.article.created event with the new version, the edit scope and the code and name', async () => {
    const client = await clientAt(given.plant());
    const id = randomUUIDv7();

    await client.send(createMutation, { input: { id, code: 'BR-140', name: 'Wall bracket' } });

    expect(await eventsOf(id)).toEqual([
      {
        event: 'core.article.created',
        schema_version: 1,
        entity_type: 'core.article',
        entity_id: id,
        entity_version: '1',
        scope_id: await editScopeOf(id),
        data: { code: 'BR-140', name: 'Wall bracket' },
        context: { actor: expect.any(String), command: 'core.createArticle' },
      },
    ]);
  });

  it('E05-S09 a retried coreCreateArticle with the same id writes no second event', async () => {
    const client = await clientAt(given.plant());
    const id = randomUUIDv7();
    await client.send(createMutation, { input: { id, code: 'CW-220', name: 'Caster wheel' } });

    await client.send(createMutation, { input: { id, code: 'CW-220', name: 'Caster wheel' } });

    expect((await eventsOf(id)).map(({ event }) => event)).toEqual(['core.article.created']);
  });

  it('E05-S09 update, archive and restore each write their event with the version after the change', async () => {
    const client = await clientAt(given.plant());
    const id = randomUUIDv7();
    await client.send(createMutation, { input: { id, code: 'HG-110', name: 'Cabinet hinge' } });

    await client.send(updateMutation, {
      input: { id, expectedVersion: 1, code: 'HG-111', name: 'Cabinet hinge, left' },
    });
    await client.send(archiveMutation, { input: { id, expectedVersion: 2 } });
    await client.send(restoreMutation, { input: { id, expectedVersion: 3 } });

    const data = { code: 'HG-111', name: 'Cabinet hinge, left' };
    expect(
      (await eventsOf(id)).map(({ event, entity_version, data, context }) => ({
        event,
        entity_version,
        data,
        command: context.command,
      })),
    ).toEqual([
      {
        event: 'core.article.created',
        entity_version: '1',
        data: { code: 'HG-110', name: 'Cabinet hinge' },
        command: 'core.createArticle',
      },
      { event: 'core.article.updated', entity_version: '2', data, command: 'core.updateArticle' },
      { event: 'core.article.archived', entity_version: '3', data, command: 'core.archiveArticle' },
      { event: 'core.article.restored', entity_version: '4', data, command: 'core.restoreArticle' },
    ]);
  });

  it('E05-S09 coreUpsertArticle writes core.article.updated with the new version when it changes an article, and no event when nothing changed', async () => {
    const client = await clientAt(given.plant());
    const id = randomUUIDv7();
    const upsert = (name: string) =>
      client.send(upsertMutation, { input: { id, code: 'UP-100', name, source: 'Pyramid' } });
    await upsert('Bolt');

    await upsert('Bolt, zinc');
    await upsert('Bolt, zinc');

    expect(
      (await eventsOf(id)).map(({ event, entity_version, scope_id, data }) => ({
        event,
        entity_version,
        scope_id,
        data,
      })),
    ).toEqual([
      {
        event: 'core.article.created',
        entity_version: '1',
        scope_id: await editScopeOf(id),
        data: { code: 'UP-100', name: 'Bolt' },
      },
      {
        event: 'core.article.updated',
        entity_version: '2',
        scope_id: await editScopeOf(id),
        data: { code: 'UP-100', name: 'Bolt, zinc' },
      },
    ]);
  });

  it('E05-S09 a refused command writes no event', async () => {
    const plant = given.plant();
    const client = await clientAt(plant);
    const id = randomUUIDv7();
    await client.send(createMutation, { input: { id, code: 'PL-300', name: 'Plate' } });

    const answer = await client.send(updateMutation, {
      input: { id, expectedVersion: 7, code: 'PL-301', name: 'Plate, wide' },
    });

    expect(answer.errors).toHaveLength(1);
    expect((await eventsOf(id)).map(({ event }) => event)).toEqual(['core.article.created']);
  });

  it('E05-S09 the app’s sequencer publishes the event after the command commits, so it gets a position', async () => {
    const client = await clientAt(given.plant());
    const id = randomUUIDv7();

    await client.send(createMutation, { input: { id, code: 'SC-500', name: 'Screw' } });

    await expect
      .poll(
        async () =>
          (
            await queryAsCore<{ position: string | null }>(
              db.ownerUrl,
              'select position::text from core.event where entity_id = $1',
              [id],
            )
          )[0]?.position,
        { timeout: 5_000 },
      )
      .toMatch(/^\d+$/);
  });
});
