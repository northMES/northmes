// SPDX-License-Identifier: AGPL-3.0-or-later
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  SESSION_LIFETIME_SECONDS,
  SESSION_RENEWAL_SECONDS,
} from '../../../src/modules/core/infrastructure/auth/auth-options.ts';
import { BetterAuth } from '../../../src/modules/core/infrastructure/auth/better-auth.ts';
import { givenCompany, hostFactory, signIn } from '../../../src/testing.ts';

/** The web app's origin in these tests, as webOrigins in northmes.config.json would list it. */
const webOrigin = 'http://localhost:5173';

const articlesQuery = '{ coreArticles(first: 5) { edges { node { code } } } }';

describe('sign-in with Better Auth', () => {
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

  /** A user who reads articles at a fresh company's plant, signed in, and that plant's slug. */
  async function reader() {
    const { plants, slugs } = await givenCompany(db.ownerUrl);
    const user = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: plants[0] ?? '', permissions: ['core.article:read'] },
    ]);
    return { user, plant: slugs[0] ?? '' };
  }

  it('E05-S05 a user signs in with username and password, and the JWT from /api/auth/token reads the API', async () => {
    const { user, plant } = await reader();

    const answer = await gqlClient(url, {
      headers: { authorization: user.authorization, 'x-northmes-plant': plant },
    }).send(articlesQuery);

    expect(answer).toEqual({ status: 200, data: { coreArticles: { edges: [] } } });
  });

  it('E05-S05 a wrong password is refused with 401', async () => {
    const { user } = await reader();

    const response = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: `${user.password}x` }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-auth-token')).toBeNull();
  });

  it('E05-S05 a username sign-in is refused with 404: the web signs in with email only', async () => {
    const { user } = await reader();

    const response = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: user.password }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('set-auth-token')).toBeNull();
  });

  it('E05-S05 sign-up is disabled', async () => {
    const response = await fetch(`${url}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'new.user@example.invalid',
        password: 'a-long-enough-password',
        name: 'New user',
      }),
    });

    expect(response.status).toBe(404);
  });

  it('E05-S05 a request without a session gets 401 as UNAUTHENTICATED', async () => {
    const answer = await gqlClient(url).send(articlesQuery);

    expect(answer.data).toBeNull();
    expect(answer.errors?.[0]?.extensions).toEqual({ code: 'UNAUTHENTICATED' });
  });

  it('E05-S05 an expired JWT gets 401 as UNAUTHENTICATED, where the same JWT before it expired reads', async () => {
    const { user, plant } = await reader();
    const now = Math.floor(Date.now() / 1000);
    const { api } = testApp.app.get(BetterAuth).auth;
    const sign = async (iat: number, exp: number) =>
      (await api.signJWT({ body: { payload: { sub: user.userId, iat, exp } } })).token;
    const send = (token: string) =>
      gqlClient(url, {
        headers: { authorization: `Bearer ${token}`, 'x-northmes-plant': plant },
      }).send(articlesQuery);

    const live = await send(await sign(now, now + 60));
    const expired = await send(await sign(now - 360, now - 60));

    expect(live).toEqual({ status: 200, data: { coreArticles: { edges: [] } } });
    expect(expired.data).toBeNull();
    expect(expired.errors?.[0]?.extensions).toEqual({ code: 'UNAUTHENTICATED' });
  });

  it('E05-S05 a session token is no bearer token for the API: only the JWT is', async () => {
    const { user, plant } = await reader();
    const signedIn = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: user.password }),
    });

    const answer = await gqlClient(url, {
      headers: {
        authorization: `Bearer ${signedIn.headers.get('set-auth-token')}`,
        'x-northmes-plant': plant,
      },
    }).send(articlesQuery);

    expect(answer.errors?.[0]?.extensions).toEqual({ code: 'UNAUTHENTICATED' });
  });

  /** Signs a user in on /api/auth/sign-in/username and returns its session token. */
  async function sessionTokenOf(user: { username: string; password: string }) {
    const signedIn = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: user.password }),
    });
    return signedIn.headers.get('set-auth-token') ?? '';
  }

  /** The session and user that /api/auth/get-session answers for a session token. */
  async function sessionOf(sessionToken: string) {
    const response = await fetch(`${url}/api/auth/get-session`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    return (await response.json()) as {
      session: { expiresAt: string };
      user: { username: string };
    };
  }

  it('E05-S05 a signed-in user cannot change their username, so a username is never reassigned', async () => {
    const { user } = await reader();
    const sessionToken = await sessionTokenOf(user);

    const renamed = await fetch(`${url}/api/auth/update-user`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ username: `${user.username}_renamed` }),
    });

    expect(renamed.status).toBe(404);
    expect((await sessionOf(sessionToken)).user.username).toBe(user.username);
  });

  it('E05-S05 a session lives 12 hours from sign-in and renews after an hour of use, as the maintainer chose', async () => {
    expect(SESSION_LIFETIME_SECONDS).toBe(12 * 60 * 60);
    expect(SESSION_RENEWAL_SECONDS).toBe(60 * 60);
    const { user } = await reader();
    const before = Date.now();

    const { session } = await sessionOf(await sessionTokenOf(user));

    const expiresAt = new Date(session.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + SESSION_LIFETIME_SECONDS * 1000 - 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + SESSION_LIFETIME_SECONDS * 1000 + 1000);
  });

  it('E05-S05 a request from an origin that webOrigins does not list is refused with 403', async () => {
    const { user } = await reader();

    const signInFromElsewhere = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://intranet.example.com' },
      body: JSON.stringify({ username: user.username, password: user.password }),
    });
    const graphqlFromElsewhere = await fetch(`${url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://intranet.example.com',
        authorization: user.authorization,
      },
      body: JSON.stringify({ query: articlesQuery }),
    });

    expect(signInFromElsewhere.status).toBe(403);
    expect(signInFromElsewhere.headers.get('set-auth-token')).toBeNull();
    expect(graphqlFromElsewhere.status).toBe(403);
    expect(graphqlFromElsewhere.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('E05-S05 the web origin signs in across origins: its preflight passes, it may read the token and retry headers, and it may send no cookies', async () => {
    const { user } = await reader();

    const preflight = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'OPTIONS',
      headers: {
        origin: webOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    const signedIn = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: webOrigin },
      body: JSON.stringify({ username: user.username, password: user.password }),
    });
    const refused = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: webOrigin },
      body: JSON.stringify({ username: user.username, password: `${user.password}!` }),
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(webOrigin);
    expect(preflight.headers.get('access-control-allow-headers')).toContain('authorization');
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get('access-control-allow-origin')).toBe(webOrigin);
    expect(signedIn.headers.get('access-control-expose-headers')).toContain('set-auth-token');
    expect(signedIn.headers.get('set-auth-token')).toBeTruthy();
    // The web reads Better Auth's X-Retry-After to say how long a rate-limited sign-in waits. A
    // refused sign-in answers as a 429 does, without the bearer plugin's own expose header.
    expect(preflight.headers.get('access-control-expose-headers')).toContain('x-retry-after');
    expect(refused.status).toBe(401);
    expect(refused.headers.get('access-control-expose-headers')).toContain('x-retry-after');
    // The web sends no cookies, so the API does not let a web origin send them.
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
    expect(signedIn.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('signIn fails with the status and body when /api/auth/token refuses the session token', async () => {
    const { plants } = await givenCompany(db.ownerUrl);
    const [plant = ''] = plants;
    const realFetch = globalThis.fetch;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) =>
        String(input).endsWith('/api/auth/token')
          ? Promise.resolve(new Response('{"message":"refused"}', { status: 401 }))
          : realFetch(input, init),
      );

    try {
      await expect(
        signIn(testApp.app, db.ownerUrl, [{ scopeId: plant, permissions: ['core.article:read'] }]),
      ).rejects.toThrow('signIn: /api/auth/token answered 401: {"message":"refused"}');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
