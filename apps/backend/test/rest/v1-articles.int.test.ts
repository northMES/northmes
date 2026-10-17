// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import {
  givenArticle,
  givenArticles,
  givenCompany,
  givenPublicApiToken,
  givenUser,
  hostFactory,
  hostFactoryWithPublicApi,
  signIn,
} from '@northmes/backend/testing';
import { API_CONTROLLER_METADATA, PROBLEM_TYPE_BASE, publicApiOperationsOf } from '@northmes/sdk/rest';
import { createTestApp, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Every core.article permission. */
const articlePermissions = ['read', 'create', 'update', 'archive', 'assign'].map(
  (action) => `core.article:${action}`,
);

/** The article routes of ADR 0073 section 2, each with an input that names no row. */
const articleRoutes = [
  ['GET', 'articles'],
  ['GET', `articles/${randomUUIDv7()}`],
  ['POST', 'commands/create-article'],
  ['POST', 'commands/update-article'],
  ['POST', 'commands/set-article-plants'],
  ['POST', 'commands/archive-article'],
  ['POST', 'commands/restore-article'],
  ['POST', 'commands/upsert-article'],
] as const;

/** A code no other test uses. */
const code = () => `RA-${randomBytes(3).toString('hex')}`;

describe('the public article routes without the credential guard', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;
  let url = '';

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  it('ADR0073-W4 every article route refuses a request without a credential with 401 core.unauthenticated as a problem', async () => {
    for (const [method, path] of articleRoutes) {
      const response = await fetch(`${url}/api/v1/core/${path}`, {
        method,
        ...(method === 'POST'
          ? { headers: { 'content-type': 'application/json' }, body: '{}' }
          : {}),
      });

      expect({ method, path, status: response.status }).toEqual({ method, path, status: 401 });
      expect(response.headers.get('content-type')).toMatch(/^application\/problem\+json/);
      expect(await response.json()).toMatchObject({
        type: `${PROBLEM_TYPE_BASE}core.unauthenticated`,
        status: 401,
        code: 'core.unauthenticated',
        instance: `/api/v1/core/${path}`,
      });
    }
  });

  it("ADR0073-W4 the web's JWT on a public route returns 401", async () => {
    if (!testApp) throw new Error('the test app did not start');
    const { company, plants } = await givenCompany(db.ownerUrl, {});
    await givenArticle(db.ownerUrl, { code: code(), name: 'Bolt', plants: [...plants] });
    const { authorization } = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: company, permissions: articlePermissions },
    ]);

    const response = await fetch(`${url}/api/v1/core/articles`, { headers: { authorization } });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'core.unauthenticated' });
  });
});

describe('the public article routes', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;
  let url = '';

  beforeAll(async () => {
    testApp = await createTestApp({
      modules: ['core'],
      hostFactory: hostFactoryWithPublicApi,
      database: db,
    });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  /**
   * A company with the plants HEL and STO, and the Authorization header of a test credential of the
   * company whose principal holds `permissions` at the company.
   */
  async function givenPlace(permissions: readonly string[] = articlePermissions) {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {
      plantNames: ['HEL', 'STO'],
    });
    const [hel = '', sto = ''] = plants;
    const [helSlug = '', stoSlug = ''] = slugs;
    const userId = await givenUser(db.ownerUrl, [{ scopeId: company, permissions }]);
    const authorization = givenPublicApiToken({ userId, companyId: company });
    return { company, hel, sto, helSlug, stoSlug, authorization };
  }

  /** Sends a request to an article route as the credential. */
  async function send(
    authorization: string,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<{ status: number; contentType: string; body: Record<string, unknown> }> {
    const response = await fetch(`${url}/api/v1/core/${path}`, {
      method,
      headers: { authorization, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  /** The codes of a list answer. */
  function codesOf(body: Record<string, unknown>): string[] {
    return (body.nodes as { code: string }[]).map((node) => node.code);
  }

  it('ADR0073-W4 GET /api/v1/core/articles without plant lists every article of the company, unassigned ones included, and with plant those assigned to it or to All plants', async () => {
    const { company, hel, sto, helSlug, authorization } = await givenPlace();
    const [atHel, atSto, everywhere, unassigned] = [code(), code(), code(), code()];
    await givenArticles(db.ownerUrl, [
      { code: atHel, name: 'Bolt', plants: [hel] },
      { code: atSto, name: 'Nut', plants: [sto] },
      { code: everywhere, name: 'Washer', allPlants: true, company },
      { code: unassigned, name: 'Shim', company },
    ]);

    const atCompany = await send(authorization, 'GET', 'articles');
    const atPlant = await send(authorization, 'GET', `articles?plant=${helSlug}`);

    expect(atCompany.status).toBe(200);
    expect(codesOf(atCompany.body).sort()).toEqual([atHel, atSto, everywhere, unassigned].sort());
    expect(codesOf(atPlant.body).sort()).toEqual([atHel, everywhere].sort());
  });

  it('ADR0073-W4 a list with first=2 returns two articles and a cursor that returns the third', async () => {
    const { company, authorization } = await givenPlace();
    const prefix = code();
    await givenArticles(
      db.ownerUrl,
      ['A', 'B', 'C'].map((letter) => ({ code: `${prefix}-${letter}`, name: letter, company })),
    );

    const first = await send(authorization, 'GET', 'articles?first=2&orderBy=-code');
    const cursor = (first.body.pageInfo as { endCursor: string }).endCursor;
    const next = await send(
      authorization,
      'GET',
      `articles?first=2&orderBy=-code&after=${encodeURIComponent(cursor)}`,
    );

    expect(codesOf(first.body)).toEqual([`${prefix}-C`, `${prefix}-B`]);
    expect(first.body.pageInfo).toMatchObject({ hasNextPage: true });
    expect(codesOf(next.body)).toEqual([`${prefix}-A`]);
  });

  it('ADR0073-W4 GET /api/v1/core/articles/{id} returns the article, and an unknown id 404 core.not_found as a problem', async () => {
    const { hel, helSlug, authorization } = await givenPlace();
    const articleCode = code();
    const id = await givenArticle(db.ownerUrl, { code: articleCode, name: 'Bolt', plants: [hel] });

    const found = await send(authorization, 'GET', `articles/${id}`);
    const missing = await send(authorization, 'GET', `articles/${randomUUIDv7()}`);

    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({
      id,
      code: articleCode,
      name: 'Bolt',
      allPlants: false,
      plants: [helSlug],
      version: 1,
      archivedAt: null,
    });
    expect(found.body).not.toHaveProperty('scope_id');
    expect(missing.status).toBe(404);
    expect(missing.contentType).toMatch(/^application\/problem\+json/);
    expect(missing.body).toMatchObject({ status: 404, code: 'core.not_found' });
  });

  it('ADR0073-W4 POST commands/create-article answers 201 with the article, and a retry with the same id 200 with the stored article', async () => {
    const { helSlug, authorization } = await givenPlace();
    const input = { id: randomUUIDv7(), code: code(), name: 'Bolt', plants: [helSlug] };

    const created = await send(authorization, 'POST', 'commands/create-article', input);
    const retried = await send(authorization, 'POST', 'commands/create-article', input);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: input.id, code: input.code, plants: [helSlug] });
    expect(retried.status).toBe(200);
    expect(retried.body).toEqual(created.body);
  });

  it('ADR0073-W4 a create with allPlants true and a non-empty plants returns 400 core.invalid_input with a field error on plants', async () => {
    const { helSlug, authorization } = await givenPlace();

    const answer = await send(authorization, 'POST', 'commands/create-article', {
      id: randomUUIDv7(),
      code: code(),
      name: 'Bolt',
      allPlants: true,
      plants: [helSlug],
    });

    expect(answer.status).toBe(400);
    expect(answer.contentType).toMatch(/^application\/problem\+json/);
    expect(answer.body).toMatchObject({
      type: `${PROBLEM_TYPE_BASE}core.invalid_input`,
      title: 'Invalid input',
      code: 'core.invalid_input',
      errors: [{ path: ['plants'], message: 'Choose plants or All plants, not both.' }],
      correlationId: expect.any(String),
    });
  });

  it('ADR0073-W4 POST commands/update-article changes the article, and a stale expectedVersion returns 409 core.version_conflict as a problem', async () => {
    const { hel, authorization } = await givenPlace();
    const id = await givenArticle(db.ownerUrl, { code: code(), name: 'Bolt', plants: [hel] });
    const newCode = code();

    const updated = await send(authorization, 'POST', 'commands/update-article', {
      id,
      expectedVersion: 1,
      code: newCode,
      name: 'Bolt M8',
    });
    const stale = await send(authorization, 'POST', 'commands/update-article', {
      id,
      expectedVersion: 1,
      code: newCode,
      name: 'Bolt M10',
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id, code: newCode, name: 'Bolt M8', version: 2 });
    expect(stale.status).toBe(409);
    expect(stale.contentType).toMatch(/^application\/problem\+json/);
    expect(stale.body).toMatchObject({ status: 409, code: 'core.version_conflict' });
  });

  it('ADR0073-W4 POST commands/set-article-plants replaces the plants of the article', async () => {
    const { hel, helSlug, stoSlug, authorization } = await givenPlace();
    const id = await givenArticle(db.ownerUrl, { code: code(), name: 'Bolt', plants: [hel] });

    const answer = await send(authorization, 'POST', 'commands/set-article-plants', {
      id,
      expectedVersion: 1,
      allPlants: false,
      plants: [helSlug, stoSlug],
    });

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ id, allPlants: false, version: 2 });
    expect([...(answer.body.plants as string[])].sort()).toEqual([helSlug, stoSlug].sort());
  });

  it('ADR0073-W4 POST commands/archive-article archives the article and commands/restore-article restores it', async () => {
    const { hel, authorization } = await givenPlace();
    const id = await givenArticle(db.ownerUrl, { code: code(), name: 'Bolt', plants: [hel] });

    const archived = await send(authorization, 'POST', 'commands/archive-article', {
      id,
      expectedVersion: 1,
    });
    const restored = await send(authorization, 'POST', 'commands/restore-article', {
      id,
      expectedVersion: 2,
    });

    expect(archived.status).toBe(200);
    expect(archived.body).toMatchObject({ id, archivedAt: expect.any(String), version: 2 });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ id, archivedAt: null, version: 3 });
  });

  it('ADR0073-W4 POST commands/upsert-article with a new number answers 201, and with the same number and name 200 with the same version', async () => {
    const { authorization } = await givenPlace();
    const input = { id: randomUUIDv7(), code: code(), name: 'Bolt', source: 'Pyramid' };

    const created = await send(authorization, 'POST', 'commands/upsert-article', input);
    const again = await send(authorization, 'POST', 'commands/upsert-article', {
      ...input,
      id: randomUUIDv7(),
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: input.id, code: input.code, version: 1 });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ id: input.id, version: 1 });
  });

  it('ADR0073-W4 a credential without core.article:create gets 403 core.forbidden as a problem', async () => {
    const { authorization } = await givenPlace(['core.article:read']);

    const answer = await send(authorization, 'POST', 'commands/create-article', {
      id: randomUUIDv7(),
      code: code(),
      name: 'Bolt',
    });

    expect(answer.status).toBe(403);
    expect(answer.contentType).toMatch(/^application\/problem\+json/);
    expect(answer.body).toMatchObject({ title: 'Not permitted', code: 'core.forbidden' });
  });

  it('ADR0073-W4 a plant of another company in plant returns 403 core.plant_forbidden', async () => {
    const { authorization } = await givenPlace();
    const other = await givenCompany(db.ownerUrl, {});

    const answer = await send(authorization, 'GET', `articles?plant=${other.slugs[0]}`);

    expect(answer.status).toBe(403);
    expect(answer.body).toMatchObject({ code: 'core.plant_forbidden' });
  });

  it('ADR0073-W4 the article routes carry the operation ids of ADR 0073, and each is a root field of the GraphQL schema', () => {
    if (!testApp) throw new Error('the test app did not start');
    const controllers = [...testApp.app.get(ModulesContainer).values()].flatMap((module) =>
      [...module.controllers.values()].map(({ metatype }) => metatype as Type),
    );
    const publicControllers = controllers.filter(
      (controller) => Reflect.getMetadata(API_CONTROLLER_METADATA, controller)?.family === 'public',
    );
    const operations = publicControllers
      .flatMap(publicApiOperationsOf)
      .filter(({ operation }) => operation.includes('Article') && !operation.includes('Group'));
    const schema = readFileSync(new URL('../../../../schema/api.graphql', import.meta.url), 'utf8');

    expect(operations.map(({ method, path, operationId }) => [method, path, operationId])).toEqual(
      [
        ['GET', '/api/v1/core/articles', 'coreArticles'],
        ['GET', '/api/v1/core/articles/{id}', 'coreArticle'],
        ['POST', '/api/v1/core/commands/create-article', 'coreCreateArticle'],
        ['POST', '/api/v1/core/commands/update-article', 'coreUpdateArticle'],
        ['POST', '/api/v1/core/commands/set-article-plants', 'coreSetArticlePlants'],
        ['POST', '/api/v1/core/commands/archive-article', 'coreArchiveArticle'],
        ['POST', '/api/v1/core/commands/restore-article', 'coreRestoreArticle'],
        ['POST', '/api/v1/core/commands/upsert-article', 'coreUpsertArticle'],
      ],
    );
    for (const { operationId } of operations) {
      expect(schema).toMatch(new RegExp(`^  ${operationId}\\(`, 'm'));
    }
  });
});
