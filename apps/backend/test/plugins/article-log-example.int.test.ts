// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createTestApp, given, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import manifest from '../../../../examples/plugin-article-log/src/manifest.ts';
import {
  hostFactoryWithPlugins,
  migratePlugins,
  type SourcePlugin,
  signInAt,
} from '../../src/testing.ts';

const articleLog: SourcePlugin = {
  manifest,
  migrationsDir: fileURLToPath(
    new URL('../../../../examples/plugin-article-log/migrations', import.meta.url),
  ),
};

/**
 * The article log example under examples/ logs every create, update, archive and restore of an article
 * (ADR 0014). The test lives here because example plugins import no AGPL package, the host included.
 */
describe('the example article log plugin', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    await migratePlugins(db.ownerUrl, [articleLog]);
    testApp = await createTestApp({
      modules: ['core'],
      hostFactory: hostFactoryWithPlugins([articleLog]),
      database: db,
    });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** The plugin's entries of one article, read as the plugin's owner role, which RLS does not bind. */
  async function entriesOf(articleId: string) {
    const client = new Client({ connectionString: db.ownerUrl });
    await client.connect();
    try {
      await client.query('set role nm_mod_example_article_log');
      const { rows } = await client.query(
        `select event, article_version::int as version, name
           from example_article_log.entry where article_id = $1 order by article_version`,
        [articleId],
      );
      return rows;
    } finally {
      await client.end();
    }
  }

  it('keeps one entry per article event, in the order the commands ran', {
    timeout: 30_000,
  }, async () => {
    if (!testApp) throw new Error('the test app did not start');
    const headers = await signInAt(testApp.app, db.ownerUrl, given.plant());
    const client = gqlClient(await testApp.app.getUrl(), { headers });
    const id = randomUUIDv7();
    /** Runs core's mutation for `command`, such as CreateArticle, and fails on an error. */
    const run = async (command: string, input: Record<string, unknown>) => {
      const answer = await client.send(
        `mutation ($input: Core${command}Input!) { core${command}(input: $input) { id } }`,
        { input },
      );
      expect(answer.errors).toBeUndefined();
    };

    await run('CreateArticle', { id, code: 'LG-100', name: 'Hinge' });
    await run('UpdateArticle', { id, expectedVersion: 1, code: 'LG-100', name: 'Hinge, left' });
    await run('ArchiveArticle', { id, expectedVersion: 2 });
    await run('RestoreArticle', { id, expectedVersion: 3 });

    await expect
      .poll(() => entriesOf(id), { timeout: 15_000 })
      .toEqual([
        { event: 'core.article.created', version: 1, name: 'Hinge' },
        { event: 'core.article.updated', version: 2, name: 'Hinge, left' },
        { event: 'core.article.archived', version: 3, name: 'Hinge, left' },
        { event: 'core.article.restored', version: 4, name: 'Hinge, left' },
      ]);
  });
});
