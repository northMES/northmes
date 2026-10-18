// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import {
  givenCompany,
  givenPublicApiToken,
  givenUser,
  hostFactoryWithPublicApi,
  signIn,
} from '@northmes/backend/testing';
import { PROBLEM_TYPE_BASE } from '@northmes/sdk/rest';
import { createTestApp, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const backendVersion = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

describe('GET /api/v1/openapi.json', () => {
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

  async function get(headers: Record<string, string> = {}) {
    const response = await fetch(`${url}/api/v1/openapi.json`, { headers });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  it('ADR0073-W4 an anonymous request gets 401 core.unauthenticated as a problem', async () => {
    const { status, contentType, body } = await get();

    expect(status).toBe(401);
    expect(contentType).toMatch(/^application\/problem\+json/);
    expect(body).toMatchObject({
      type: `${PROBLEM_TYPE_BASE}core.unauthenticated`,
      status: 401,
      code: 'core.unauthenticated',
      instance: '/api/v1/openapi.json',
    });
  });

  it('ADR0073-W4 a bearer token that is no credential gets 401', async () => {
    const { status } = await get({ authorization: 'Bearer nms_int_not-a-token' });

    expect(status).toBe(401);
  });

  it("ADR0073-W4 a credential of the public API gets the installation's document, with info.version the image version", async () => {
    const { company } = await givenCompany(db.ownerUrl, {});
    const userId = await givenUser(db.ownerUrl, [{ scopeId: company, permissions: [] }]);

    const { status, contentType, body } = await get({
      authorization: givenPublicApiToken({ userId, companyId: company }),
    });

    expect(status).toBe(200);
    expect(contentType).toMatch(/^application\/json/);
    expect(body).toMatchObject({ openapi: '3.1.0', info: { version: backendVersion } });
    expect(Object.keys(body.paths as object)).toEqual(
      expect.arrayContaining(['/api/v1/core/articles', '/api/v1/core/article-groups/{id}']),
    );
  });

  it("ADR0073-W4 the web's JWT gets the same document", async () => {
    if (!testApp) throw new Error('the test app did not start');
    const { company } = await givenCompany(db.ownerUrl, {});
    const { authorization } = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: company, permissions: [] },
    ]);
    const userId = await givenUser(db.ownerUrl, [{ scopeId: company, permissions: [] }]);
    const token = givenPublicApiToken({ userId, companyId: company });

    const web = await get({ authorization });

    expect(web.status).toBe(200);
    expect(web.body).toEqual((await get({ authorization: token })).body);
  });
});
