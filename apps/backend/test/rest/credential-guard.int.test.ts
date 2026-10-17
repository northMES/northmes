// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import {
  givenArticle,
  givenCompany,
  givenIntegrationToken,
  hostFactory,
  queryAsCore,
  signIn,
} from '@northmes/backend/testing';
import { createTestApp, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The credential guard of the public REST family (ADR 0073 section 5, credentials by surface): the
// server's own guard, with real integration tokens from core.createIntegrationToken. A public
// route accepts only Authorization: Bearer with an nms_int_ token; the web's JWT, a cookie and no
// header answer 401 core.unauthenticated, and /graphql refuses an integration token.

/** A code no other test uses. */
const code = () => `CG-${randomBytes(3).toString('hex')}`;

describe('the credential guard of the public API', () => {
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

  function app() {
    if (!testApp) throw new Error('the test app did not start');
    return testApp.app;
  }

  /** A company with the plants HEL and STO. */
  async function givenPlace() {
    const { company, plants, slugs } = await givenCompany(db.ownerUrl, {
      plantNames: ['HEL', 'STO'],
    });
    const [hel = '', sto = ''] = plants;
    const [helSlug = '', stoSlug = ''] = slugs;
    return { company, hel, sto, helSlug, stoSlug };
  }

  /** A token of `companyId` bound to `scopeId` whose role holds `permissions`. */
  function token(companyId: string, scopeId: string, permissions: readonly string[]) {
    return givenIntegrationToken(app(), db.ownerUrl, { companyId, scopeId, permissions });
  }

  /** Sends a request to a route under /api/v1/core with these headers. */
  async function send(
    headers: Record<string, string>,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<{ status: number; contentType: string; body: Record<string, unknown> }> {
    const response = await fetch(`${url}/api/v1/core/${path}`, {
      method,
      headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  it('ADR0073-W4 a live integration token reads and writes articles within its roles', async () => {
    const { company, hel, helSlug } = await givenPlace();
    const articleCode = code();
    const id = await givenArticle(db.ownerUrl, { code: articleCode, name: 'Bolt', plants: [hel] });
    const { authorization } = await token(company, company, [
      'core.article:read',
      'core.article:create',
    ]);

    const listed = await send({ authorization }, 'GET', `articles?plant=${helSlug}`);
    const read = await send({ authorization }, 'GET', `articles/${id}`);
    const created = await send({ authorization }, 'POST', 'commands/create-article', {
      id: randomUUIDv7(),
      code: code(),
      name: 'Nut',
      plants: [helSlug],
    });

    expect(listed.status).toBe(200);
    expect((listed.body.nodes as { code: string }[]).map((node) => node.code)).toEqual([
      articleCode,
    ]);
    expect(read).toMatchObject({ status: 200, body: { id, code: articleCode } });
    expect(created).toMatchObject({ status: 201, body: { name: 'Nut', plants: [helSlug] } });
  });

  it('ADR0073-W4 a token without the permission gets 403 core.forbidden as a problem', async () => {
    const { company } = await givenPlace();
    const { authorization } = await token(company, company, ['core.article:read']);

    const answer = await send({ authorization }, 'POST', 'commands/create-article', {
      id: randomUUIDv7(),
      code: code(),
      name: 'Bolt',
    });

    expect(answer.status).toBe(403);
    expect(answer.contentType).toMatch(/^application\/problem\+json/);
    expect(answer.body).toMatchObject({ code: 'core.forbidden' });
  });

  it('ADR0073-W4 a token bound to plant A acts at A and gets 403 core.plant_forbidden at plant B', async () => {
    const { company, hel, helSlug, stoSlug } = await givenPlace();
    const { authorization } = await token(company, hel, ['core.article:read']);

    const atHel = await send({ authorization }, 'GET', `articles?plant=${helSlug}`);
    const atSto = await send({ authorization }, 'GET', `articles?plant=${stoSlug}`);

    expect(atHel.status).toBe(200);
    expect(atSto.status).toBe(403);
    expect(atSto.contentType).toMatch(/^application\/problem\+json/);
    expect(atSto.body).toMatchObject({ code: 'core.plant_forbidden' });
  });

  it('ADR0073-W4 a token bound to the company acts at the company without a plant and at each of its plants, and not at a plant of another company', async () => {
    const { company, helSlug, stoSlug } = await givenPlace();
    const other = await givenPlace();
    const { authorization } = await token(company, company, ['core.article:read']);

    const atCompany = await send({ authorization }, 'GET', 'articles');
    const atHel = await send({ authorization }, 'GET', `articles?plant=${helSlug}`);
    const atSto = await send({ authorization }, 'GET', `articles?plant=${stoSlug}`);
    const elsewhere = await send({ authorization }, 'GET', `articles?plant=${other.helSlug}`);

    expect([atCompany.status, atHel.status, atSto.status]).toEqual([200, 200, 200]);
    expect(elsewhere.status).toBe(403);
    expect(elsewhere.body).toMatchObject({ code: 'core.plant_forbidden' });
  });

  it("ADR0073-W4 another company's article is not found", async () => {
    const { company } = await givenPlace();
    const other = await givenPlace();
    const id = await givenArticle(db.ownerUrl, { code: code(), name: 'Bolt', plants: [other.hel] });
    const { authorization } = await token(company, company, ['core.article:read']);

    const answer = await send({ authorization }, 'GET', `articles/${id}`);

    expect(answer.status).toBe(404);
    expect(answer.body).toMatchObject({ code: 'core.not_found' });
  });

  it('ADR0073-W4 a revoked token returns 401 core.unauthenticated', async () => {
    const { company } = await givenPlace();
    const given = await token(company, company, ['core.article:read']);
    expect((await send({ authorization: given.authorization }, 'GET', 'articles')).status).toBe(
      200,
    );

    await given.revoke();
    const answer = await send({ authorization: given.authorization }, 'GET', 'articles');

    expect(answer.status).toBe(401);
    expect(answer.contentType).toMatch(/^application\/problem\+json/);
    expect(answer.body).toMatchObject({ code: 'core.unauthenticated' });
  });

  it('ADR0073-W4 an expired token returns 401 core.unauthenticated', async () => {
    const { company } = await givenPlace();
    const given = await token(company, company, ['core.article:read']);
    await queryAsCore(
      db.ownerUrl,
      `update core.credential
          set created_at = now() - interval '10 days', expires_at = now() - interval '1 second'
        where id = $1`,
      [given.id],
    );

    const answer = await send({ authorization: given.authorization }, 'GET', 'articles');

    expect(answer.status).toBe(401);
    expect(answer.body).toMatchObject({ code: 'core.unauthenticated' });
  });

  it('ADR0073-W4 a bearer that is no integration token returns 401, and so does a request without one', async () => {
    const { company } = await givenPlace();
    const { secret } = await token(company, company, ['core.article:read']);

    for (const headers of [
      {},
      { authorization: `Bearer nms_int_${'a'.repeat(64)}` },
      { authorization: `Bearer nms_pat_${secret.slice('nms_int_'.length)}` },
      { authorization: `Basic ${Buffer.from(`x:${secret}`).toString('base64')}` },
      { authorization: secret },
    ]) {
      const answer = await send(headers, 'GET', 'articles');
      expect({ headers, status: answer.status }).toEqual({ headers, status: 401 });
      expect(answer.body).toMatchObject({ code: 'core.unauthenticated' });
    }
  });

  it("ADR0073-W4 the web's JWT on a public route returns 401", async () => {
    const { company } = await givenPlace();
    const { authorization } = await signIn(app(), db.ownerUrl, [
      { scopeId: company, permissions: ['core.article:read'] },
    ]);

    const answer = await send({ authorization }, 'GET', 'articles');

    expect(answer.status).toBe(401);
    expect(answer.body).toMatchObject({ code: 'core.unauthenticated' });
  });

  it('ADR0073-W4 a public route ignores cookies, also one that holds a live token', async () => {
    const { company } = await givenPlace();
    const { secret } = await token(company, company, ['core.article:read']);

    for (const cookie of [
      `authorization=Bearer ${secret}`,
      `better-auth.session_token=${secret}`,
      `__Secure-better-auth.session_token=${secret}`,
    ]) {
      const answer = await send({ cookie }, 'GET', 'articles');
      expect({ cookie, status: answer.status }).toEqual({ cookie, status: 401 });
    }
  });

  it('ADR0073-W4 an integration token on POST /graphql is refused as unauthenticated', async () => {
    const { company } = await givenPlace();
    const { authorization } = await token(company, company, ['core.article:read']);

    const response = await fetch(`${url}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({
        query: 'query ($companyId: ID) { coreArticles(companyId: $companyId) { totalCount } }',
        variables: { companyId: company },
      }),
    });
    const answer = (await response.json()) as {
      data?: unknown;
      errors?: { extensions?: { code?: string } }[];
    };

    expect(answer.data ?? null).toBeNull();
    expect(answer.errors?.map(({ extensions }) => extensions?.code)).toEqual(['UNAUTHENTICATED']);
  });
});
