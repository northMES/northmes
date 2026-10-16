// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createTestApp, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BetterAuth } from '../../../src/modules/core/infrastructure/auth/better-auth.ts';
import { fromNewClient, givenCompany, hostFactory, signIn } from '../../../src/testing.ts';

/** The web app's origin in these tests, as webOrigins in northmes.config.json would list it. */
const webOrigin = 'http://localhost:5173';

describe("Better Auth's routes over HTTP", () => {
  const db = useTestDatabase();
  let testApp: TestApp;
  let url: string;

  beforeAll(async () => {
    testApp = await createTestApp({
      modules: ['core'],
      hostFactory,
      database: db,
      webOrigins: [webOrigin],
    });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  /** A member of a fresh company, signed in on the web, and the session token that sign-in gave. */
  async function member() {
    const { plants } = await givenCompany(db.ownerUrl);
    const user = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plants[0] ?? '', permissions: ['core.article:read'] },
    ]);
    const signedIn = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: webOrigin, ...fromNewClient() },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    return { user, sessionToken: signedIn.headers.get('set-auth-token') ?? '' };
  }

  it("B2 an organization route answers 404 over HTTP, so a member reads no colleague's email and cannot leave", async () => {
    const { sessionToken } = await member();
    const headers = {
      'content-type': 'application/json',
      origin: webOrigin,
      authorization: `Bearer ${sessionToken}`,
    };

    const members = await fetch(`${url}/api/auth/organization/list-members`, { headers });
    const leave = await fetch(`${url}/api/auth/organization/leave`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ organizationId: 'any' }),
    });

    expect(sessionToken).not.toBe('');
    expect(members.status).toBe(404);
    expect(leave.status).toBe(404);
  });

  it('B2 the open Better Auth routes are exactly the ones the web calls: sign-in, the JWT and sign-out', async () => {
    const endpoints = Object.values(
      testApp.app.get(BetterAuth).auth.api as Record<
        string,
        { path?: string; options?: { method?: string | string[] } }
      >,
    ).filter((endpoint) => endpoint.path !== undefined);

    const open: string[] = [];
    for (const { path = '', options } of endpoints) {
      const declared = options?.method ?? 'GET';
      const method = (Array.isArray(declared) ? declared[0] : declared) ?? 'GET';
      // A route with a parameter, such as /callback/:id, is asked for with a value in its place.
      const response = await fetch(`${url}/api/auth${path.replaceAll(/:\w+/g, 'x')}`, {
        method: method === '*' ? 'GET' : method,
        redirect: 'manual',
        headers: { 'content-type': 'application/json', origin: webOrigin },
        ...(method === 'GET' || method === '*' ? {} : { body: '{}' }),
      });
      // A closed route answers a plain "Not Found", before it runs. A route that runs and answers
      // 404 itself, as for an invitation it cannot find, answers a JSON error and counts as open.
      const closed = response.status === 404 && (await response.text()) === 'Not Found';
      if (!closed) open.push(path);
    }

    expect(endpoints.length).toBeGreaterThan(50);
    expect(open.sort()).toEqual(['/sign-in/email', '/sign-out', '/token']);
  });
});
