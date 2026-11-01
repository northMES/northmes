// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import {
  givenArticle,
  givenCompany,
  hostFactory,
  queryAsCore,
  signIn,
} from '@northmes/backend/testing';
import {
  articleGroupOperations,
  articleOperations,
  equipmentGroups,
} from '@northmes/core-contracts';
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
        return { id: randomUUIDv7(), code: code(), name: 'Nut' };
      case 'upsert':
        return { id: randomUUIDv7(), code: code(), name: 'Nut', source: 'Pyramid' };
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
    url: () => {
      if (!testApp) throw new Error('the test app did not start');
      return testApp.app.getUrl();
    },
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

describe('core article group operations', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A code no other test uses. */
  const code = () => `GR-${randomBytes(3).toString('hex')}`;

  /**
   * A fresh company with one plant and the headers of a user at the plant: one who holds every
   * article group permission at the company, or one who holds only core.user:read there.
   */
  async function place(permitted: boolean) {
    if (!testApp) throw new Error('the test app did not start');
    const { company, slugs } = await givenCompany(db.ownerUrl, {});
    const permissions = permitted
      ? ['read', 'create', 'update', 'archive'].map((action) => `core.articleGroup:${action}`)
      : ['core.user:read'];
    const user = await signIn(testApp.app, db.ownerUrl, [{ scopeId: company, permissions }]);
    const headers = new Headers({
      authorization: user.authorization,
      'x-northmes-plant': slugs[0] ?? '',
    });
    return { company, headers };
  }

  /** An input that fits operation `key` at this company, with a group written as core's owner. */
  async function inputFor(key: string, company: string) {
    const id = randomUUIDv7();
    await queryAsCore(
      db.ownerUrl,
      `insert into core.article_group (id, scope_id, company_id, code, name, archived_at)
       values ($1, $2, $2, $3, 'Flanges', $4)`,
      [id, company, code(), key === 'restore' ? new Date('2026-10-01T00:00:00Z') : null],
    );
    switch (key) {
      case 'find':
        return {};
      case 'get':
        return { id };
      case 'create':
        return { id: randomUUIDv7(), code: code(), name: 'Shafts' };
      case 'update':
        return { id, expectedVersion: 1, code: code(), name: 'Flanges, steel' };
      default:
        return { id, expectedVersion: 1 };
    }
  }

  operationsConformance(articleGroupOperations, {
    story: 'E06-S06',
    url: () => {
      if (!testApp) throw new Error('the test app did not start');
      return testApp.app.getUrl();
    },
    async run({ key, surface, permitted }: ConformanceCall) {
      if (!testApp) throw new Error('the test app did not start');
      const { company, headers } = await place(permitted);
      const operation =
        articleGroupOperations.operations[key as keyof typeof articleGroupOperations.operations];
      return testApp.app.get(OperationRunner).run({
        surface,
        operation: operation.contract.name,
        input: await inputFor(key, company),
        headers,
      });
    },
  });
});

describe('core equipment group operations', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /** A code no other test uses. */
  const code = () => `EG-${randomBytes(3).toString('hex')}`;

  /**
   * A fresh company with one plant and the headers of a user at the plant: one who holds every
   * equipment group permission at the plant, or one who holds only core.user:read there.
   */
  async function place(permitted: boolean) {
    if (!testApp) throw new Error('the test app did not start');
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {});
    const plant = plants[0] ?? '';
    const permissions = permitted
      ? ['read', 'create', 'update', 'archive'].map((action) => `core.equipmentGroup:${action}`)
      : ['core.user:read'];
    const user = await signIn(testApp.app, db.ownerUrl, [{ scopeId: plant, permissions }]);
    const headers = new Headers({
      authorization: user.authorization,
      'x-northmes-plant': slugs[0] ?? '',
    });
    return { company, plant, headers };
  }

  /** An input that fits operation `key` at this plant, with a group written as core's owner. */
  async function inputFor(key: string, { company, plant }: { company: string; plant: string }) {
    const id = randomUUIDv7();
    await queryAsCore(
      db.ownerUrl,
      `insert into core.equipment_group
         (id, company_id, scope_id, scope_span, code, name, color, color_from, archived_at)
       values ($1, $2, $3, (select span from core.scope where id = $3), $4, 'Assembly',
         'palette-1', 'set', $5)`,
      [id, company, plant, code(), key === 'restore' ? new Date('2026-10-01T00:00:00Z') : null],
    );
    switch (key) {
      case 'find':
        return {};
      case 'get':
        return { id };
      case 'create':
        return { id: randomUUIDv7(), code: code(), name: 'Turning', scope: 'plant' };
      case 'update':
        return { id, expectedVersion: 1, code: code(), name: 'Assembly, manual' };
      default:
        return { id, expectedVersion: 1 };
    }
  }

  operationsConformance(equipmentGroups.operations, {
    story: 'E06-S04',
    url: () => {
      if (!testApp) throw new Error('the test app did not start');
      return testApp.app.getUrl();
    },
    async run({ key, surface, permitted }: ConformanceCall) {
      if (!testApp) throw new Error('the test app did not start');
      const at = await place(permitted);
      const operation =
        equipmentGroups.operations.operations[
          key as keyof typeof equipmentGroups.operations.operations
        ];
      return testApp.app.get(OperationRunner).run({
        surface,
        operation: operation.contract.name,
        input: await inputFor(key, at),
        headers: at.headers,
      });
    },
  });
});
