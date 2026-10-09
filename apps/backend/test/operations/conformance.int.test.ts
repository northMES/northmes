// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import { givenArticle, givenCompany, hostFactory, signIn } from '@northmes/backend/testing';
import { articleOperations } from '@northmes/core-contracts';
import {
  type ConformanceCall,
  createTestApp,
  operationsConformance,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, beforeAll, describe } from 'vitest';
import { OperationRunner } from '../../src/operations/operation-runner.ts';

describe('core article operations', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A code no other test uses. */
  const code = () => `CF-${randomBytes(3).toString('hex')}`;

  /**
   * A fresh company with one plant, an article assigned to it, and the headers of a user at the
   * plant: one who holds every article permission at the company, or one who holds only
   * core.user:read there.
   */
  async function place(permitted: boolean) {
    if (!testApp) throw new Error('the test app did not start');
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {});
    const [plant = '', slug = ''] = [plants[0], slugs[0]];
    const permissions = permitted
      ? ['read', 'create', 'update', 'archive', 'assign'].map((action) => `core.article:${action}`)
      : ['core.user:read'];
    const user = await signIn(testApp.app, db.ownerUrl, [{ scopeId: company, permissions }]);
    const headers = new Headers({ authorization: user.authorization, 'x-northmes-plant': slug });
    return { plant, slug, headers };
  }

  /** An input that fits operation `key` at this plant. */
  async function inputFor(key: string, { plant, slug }: { plant: string; slug: string }) {
    const archived = key === 'restore';
    const id = await givenArticle(db.ownerUrl, {
      code: code(),
      name: 'Bolt',
      plants: [plant],
      ...(archived ? { archivedAt: new Date('2026-10-01T00:00:00Z') } : {}),
    });
    switch (key) {
      case 'find':
        return {};
      case 'get':
        return { id };
      case 'create':
      case 'upsert':
        return { id: randomUUIDv7(), code: code(), name: 'Nut' };
      case 'update':
        return { id, expectedVersion: 1, code: code(), name: 'Bolt M8' };
      case 'setPlants':
        return { id, expectedVersion: 1, allPlants: false, plants: [slug] };
      default:
        return { id, expectedVersion: 1 };
    }
  }

  operationsConformance(articleOperations, {
    story: 'ADR0073-W3',
    async run({ key, surface, permitted }: ConformanceCall) {
      if (!testApp) throw new Error('the test app did not start');
      const at = await place(permitted);
      const operation =
        articleOperations.operations[key as keyof typeof articleOperations.operations];
      return testApp.app.get(OperationRunner).run({
        surface,
        operation: operation.contract.name,
        input: await inputFor(key, at),
        headers: at.headers,
      });
    },
  });
});
