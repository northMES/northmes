// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUIDv7 } from 'node:crypto';
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NEW_PASSWORD_PATH } from '../../../src/modules/core/api/access/new-password.controller.ts';
import {
  JWT_KEY_ROTATION_SECONDS,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  SESSION_LIFETIME_SECONDS,
  SESSION_RENEWAL_SECONDS,
  SIGN_IN_LOCKOUT_FAILURES,
  SIGN_IN_LOCKOUT_SECONDS,
} from '../../../src/modules/core/infrastructure/auth/auth-options.ts';
import { BetterAuth } from '../../../src/modules/core/infrastructure/auth/better-auth.ts';
import {
  fromBrowser,
  fromNewClient,
  givenCompany,
  hostFactory,
  queryAsCore,
  signIn,
} from '../../../src/testing.ts';

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

  it('E05-S05 a user signs in with email and password, and the JWT from /api/auth/token reads the API', async () => {
    const { user, plant } = await reader();

    const answer = await gqlClient(url, {
      headers: { authorization: user.authorization, 'x-northmes-plant': plant },
    }).send(articlesQuery);

    expect(answer).toEqual({ status: 200, data: { coreArticles: { edges: [] } } });
  });

  it('E05-S05 a wrong password is refused with 401', async () => {
    const { user } = await reader();

    const response = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...fromBrowser(testApp.app),
        ...fromNewClient(),
      },
      body: JSON.stringify({ email: user.email, password: `${user.password}x` }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-auth-token')).toBeNull();
  });

  it('E05-S05 a username sign-in is refused with 404: the web signs in with email only', async () => {
    const { user } = await reader();

    const response = await fetch(`${url}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...fromBrowser(testApp.app),
        ...fromNewClient(),
      },
      body: JSON.stringify({ username: user.username, password: user.password }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('set-auth-token')).toBeNull();
  });

  it('E05-S05 sign-up is disabled', async () => {
    const response = await fetch(`${url}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...fromBrowser(testApp.app),
        ...fromNewClient(),
      },
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

  /** The id of the key that signed the JWT in an Authorization header. */
  function kidOf(authorization: string): string {
    const [header = ''] = authorization.replace(/^Bearer /, '').split('.');
    return (JSON.parse(Buffer.from(header, 'base64url').toString()) as { kid: string }).kid;
  }

  it('E05-S05 a JWT key signs for 30 days, then the next JWT gets a new key and the JWTs of the old key still read', async () => {
    expect(JWT_KEY_ROTATION_SECONDS).toBe(30 * 24 * 60 * 60);
    const { user, plant } = await reader();
    const oldKid = kidOf(user.authorization);
    const [key] = await queryAsCore<{ lifetime: number }>(
      db.ownerUrl,
      'select extract(epoch from "expiresAt" - "createdAt")::int as lifetime from auth.jwks where id = $1',
      [oldKid],
    );

    await queryAsCore(
      db.ownerUrl,
      'update auth.jwks set "expiresAt" = now() - interval \'1 second\' where id = $1',
      [oldKid],
    );
    const { user: next } = await reader();
    const old = await gqlClient(url, {
      headers: { authorization: user.authorization, 'x-northmes-plant': plant },
    }).send(articlesQuery);

    expect(key?.lifetime).toBe(JWT_KEY_ROTATION_SECONDS);
    expect(kidOf(next.authorization)).not.toBe(oldKid);
    expect(old).toEqual({ status: 200, data: { coreArticles: { edges: [] } } });
  });

  it('E05-S05 a session token is no bearer token for the API: only the JWT is', async () => {
    const { user, plant } = await reader();
    const signedIn = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...fromBrowser(testApp.app),
        ...fromNewClient(),
      },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });

    const answer = await gqlClient(url, {
      headers: {
        authorization: `Bearer ${signedIn.headers.get('set-auth-token')}`,
        'x-northmes-plant': plant,
      },
    }).send(articlesQuery);

    expect(answer.errors?.[0]?.extensions).toEqual({ code: 'UNAUTHENTICATED' });
  });

  /** Signs a user in on /api/auth/sign-in/email and returns its session token. */
  async function sessionTokenOf(user: { email: string; password: string }) {
    const signedIn = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...fromBrowser(testApp.app),
        ...fromNewClient(),
      },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    return signedIn.headers.get('set-auth-token') ?? '';
  }

  /** The session and user of a session token, read on the server: /get-session is closed over HTTP. */
  async function sessionOf(sessionToken: string) {
    const answer = await testApp.app.get(BetterAuth).auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${sessionToken}` }),
    });
    return answer as {
      session: { id: string; expiresAt: Date };
      user: { username: string };
    };
  }

  it('E05-S05 a signed-in user cannot change their username, so a username is never reassigned', async () => {
    const { user } = await reader();
    const sessionToken = await sessionTokenOf(user);

    const renamed = await fetch(`${url}/api/auth/update-user`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...fromBrowser(testApp.app),
        authorization: `Bearer ${sessionToken}`,
      },
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

  it('E05-S05 an expired JWT gets 401 as UNAUTHENTICATED, where the same JWT before it expired reads', async () => {
    const { user, plant } = await reader();
    const { session } = await sessionOf(await sessionTokenOf(user));
    const now = Math.floor(Date.now() / 1000);
    const { api } = testApp.app.get(BetterAuth).auth;
    const sign = async (iat: number, exp: number) =>
      (await api.signJWT({ body: { payload: { sub: user.userId, sid: session.id, iat, exp } } }))
        .token;
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

  it('E05-S05 a JWT that names no session gets 401 as UNAUTHENTICATED', async () => {
    const { user, plant } = await reader();
    const now = Math.floor(Date.now() / 1000);
    const { api } = testApp.app.get(BetterAuth).auth;
    const { token } = await api.signJWT({
      body: { payload: { sub: user.userId, iat: now, exp: now + 60 } },
    });

    const answer = await gqlClient(url, {
      headers: { authorization: `Bearer ${token}`, 'x-northmes-plant': plant },
    }).send(articlesQuery);

    expect(answer.errors?.[0]?.extensions).toEqual({ code: 'UNAUTHENTICATED' });
  });

  it('E05-S05 a session older than the absolute lifetime cannot mint a JWT, however much it was used', async () => {
    expect(SESSION_ABSOLUTE_LIFETIME_SECONDS).toBe(24 * 60 * 60);
    const { user } = await reader();
    const sessionToken = await sessionTokenOf(user);
    const signedInAt = Date.now();
    const mint = () =>
      fetch(`${url}/api/auth/token`, { headers: { authorization: `Bearer ${sessionToken}` } });
    vi.useFakeTimers({ toFake: ['Date'] });

    try {
      const minted: number[] = [];
      // Each request renews the session, once its last renewal is an hour old.
      for (const hours of [6, 11.5, 17, 22.5, 23.9]) {
        vi.setSystemTime(signedInAt + hours * 60 * 60 * 1000);
        minted.push((await mint()).status);
      }
      vi.setSystemTime(signedInAt + SESSION_ABSOLUTE_LIFETIME_SECONDS * 1000 + 1000);
      const late = await mint();

      expect(minted).toEqual([200, 200, 200, 200, 200]);
      expect(late.status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it('E05-S05 a JWT is refused once its session signed out', async () => {
    const { user, plant } = await reader();
    const sessionToken = await sessionTokenOf(user);
    const minted = await fetch(`${url}/api/auth/token`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const { token } = (await minted.json()) as { token: string };
    const send = () =>
      gqlClient(url, {
        headers: { authorization: `Bearer ${token}`, 'x-northmes-plant': plant },
      }).send(articlesQuery);

    const before = await send();
    const signedOut = await fetch(`${url}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...fromBrowser(testApp.app),
        authorization: `Bearer ${sessionToken}`,
      },
      body: '{}',
    });
    const after = await send();

    expect(before).toEqual({ status: 200, data: { coreArticles: { edges: [] } } });
    expect(signedOut.status).toBe(200);
    expect(after.errors?.[0]?.extensions).toEqual({ code: 'UNAUTHENTICATED' });
  });

  it('E05-S05 a request from an origin that webOrigins does not list is refused with 403', async () => {
    const { user } = await reader();

    const signInFromElsewhere = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://intranet.example.com' },
      body: JSON.stringify({ email: user.email, password: user.password }),
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

    const preflight = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'OPTIONS',
      headers: {
        origin: webOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    const signedIn = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: webOrigin, ...fromNewClient() },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    const refused = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: webOrigin, ...fromNewClient() },
      body: JSON.stringify({ email: user.email, password: `${user.password}!` }),
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

  /** The failed sign-ins in a row that the lockout holds for an email, 0 without a row. */
  async function failuresOf(email: string) {
    const [row] = await queryAsCore<{ count: number }>(
      db.ownerUrl,
      'select count from auth."signInFailure" where key = $1',
      [email.toLowerCase()],
    );
    return row?.count ?? 0;
  }

  /** A sign-in on /api/auth/sign-in/email with the headers given. */
  function signInWith(headers: Record<string, string>, email: string, password: string) {
    return fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ email, password }),
    });
  }

  /** The masked refusal of a request that no NorthMES web origin sent. */
  const originRefusal = (errorCode: string) => ({
    statusCode: 403,
    errorCode,
    message: expect.any(String),
    correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });

  it('E05-S05 a sign-in without an Origin header is refused with 403 core.origin_required before Better Auth reads it, so it counts toward neither the throttle nor the lockout', async () => {
    const { user } = await reader();
    const client = fromNewClient();
    const browser = { ...client, ...fromBrowser(testApp.app) };
    await signInWith(browser, user.email, `${user.password}x`);
    const before = await failuresOf(user.email);

    const refused = [];
    for (let attempt = 0; attempt < SIGN_IN_LOCKOUT_FAILURES; attempt += 1) {
      refused.push(await signInWith(client, user.email, `${user.password}x`));
    }
    const bodies = await Promise.all(refused.map((response) => response.json()));
    const after = await failuresOf(user.email);
    const signedIn = await signInWith(browser, user.email, user.password);

    expect(refused.map(({ status }) => status)).toEqual(
      Array.from({ length: SIGN_IN_LOCKOUT_FAILURES }, () => 403),
    );
    expect(bodies).toEqual(bodies.map(() => originRefusal('core.origin_required')));
    expect(refused[0]?.headers.get('set-auth-token')).toBeNull();
    expect(before).toBe(1);
    expect(after).toBe(1);
    expect(signedIn.status).toBe(200);
  });

  it('E05-S05 a sign-in from an origin that webOrigins does not list is refused with 403 core.origin_forbidden and counts toward no lockout', async () => {
    const { user } = await reader();

    const refused = await signInWith(
      { origin: 'https://intranet.example.com', ...fromNewClient() },
      user.email,
      `${user.password}x`,
    );

    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual(originRefusal('core.origin_forbidden'));
    expect(await failuresOf(user.email)).toBe(0);
  });

  it('E05-S05 a sign-in from NORTHMES_PUBLIC_ORIGIN or from a web origin succeeds', async () => {
    const { user } = await reader();

    const fromPublic = await signInWith(
      { ...fromBrowser(testApp.app), ...fromNewClient() },
      user.email,
      user.password,
    );
    const fromWeb = await signInWith(
      { origin: webOrigin, ...fromNewClient() },
      user.email,
      user.password,
    );

    expect(fromPublic.status).toBe(200);
    expect(fromPublic.headers.get('set-auth-token')).toBeTruthy();
    expect(fromWeb.status).toBe(200);
    expect(fromWeb.headers.get('set-auth-token')).toBeTruthy();
  });

  it('E05-S05 sign-out and the new password step without an Origin header are refused with 403 core.origin_required', async () => {
    const { user } = await reader();
    const sessionToken = await sessionTokenOf(user);

    const signedOut = await fetch(`${url}/api/auth/sign-out`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
      body: '{}',
    });
    const newPassword = await fetch(`${url}${NEW_PASSWORD_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: user.authorization },
      body: JSON.stringify({ currentPassword: user.password, newPassword: 'a new password' }),
    });

    expect(signedOut.status).toBe(403);
    expect(await signedOut.json()).toEqual(originRefusal('core.origin_required'));
    expect(newPassword.status).toBe(403);
    expect(await newPassword.json()).toEqual(originRefusal('core.origin_required'));
  });

  it('E05-S05 /api/auth/token mints a JWT on a GET without Origin, as a browser sends one from its own origin, and refuses a cross-site GET that names no web origin', async () => {
    const { user } = await reader();
    const sessionToken = await sessionTokenOf(user);
    const mint = (headers: Record<string, string>) =>
      fetch(`${url}/api/auth/token`, {
        headers: { authorization: `Bearer ${sessionToken}`, ...headers },
      });

    const sameOrigin = await mint({ 'sec-fetch-site': 'same-origin' });
    const withoutFetchMetadata = await mint({});
    const crossSite = await mint({ 'sec-fetch-site': 'cross-site' });
    const crossSiteFromWeb = await mint({ 'sec-fetch-site': 'cross-site', origin: webOrigin });

    expect(sameOrigin.status).toBe(200);
    expect(withoutFetchMetadata.status).toBe(200);
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toEqual(originRefusal('core.origin_required'));
    expect(crossSiteFromWeb.status).toBe(200);
  });

  /**
   * A user that a company's user admin created with coreCreateUser, with the temporary password
   * from its answer, and the slug of the company's plant.
   */
  async function temporaryUser() {
    const { company, slugs } = await givenCompany(db.ownerUrl);
    const plant = slugs[0] ?? '';
    const admin = await signIn(testApp.app, db.ownerUrl, [
      { scopeId: company, permissions: ['core.user:read', 'core.user:create'] },
    ]);
    const email = `temp_${randomUUIDv7().slice(-12)}@example.test`;
    const created = await gqlClient(url, {
      headers: { authorization: admin.authorization, 'x-northmes-plant': plant },
    }).send<{ coreCreateUser: { temporaryPassword: string } }>(
      `mutation ($input: CoreCreateUserInput!) { coreCreateUser(input: $input) { temporaryPassword } }`,
      {
        input: {
          id: randomUUIDv7(),
          username: `t_${randomUUIDv7().slice(-12)}`,
          name: 'Tove Lindqvist',
          email,
        },
      },
    );
    const temporaryPassword = created.data?.coreCreateUser.temporaryPassword ?? '';
    if (temporaryPassword === '') throw new Error(JSON.stringify(created.errors));
    return { email, temporaryPassword, plant };
  }

  /** Signs in with an email and a password as the web does, and returns the JWT's header. */
  async function jwtOf(email: string, password: string) {
    const sessionToken = await sessionTokenOf({ email, password });
    const token = await fetch(`${url}/api/auth/token`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const { token: jwt } = (await token.json()) as { token: string };
    return `Bearer ${jwt}`;
  }

  /** Sets a new password on the route of the new password step. */
  function setNewPassword(authorization: string, currentPassword: string, newPassword: string) {
    return fetch(`${url}${NEW_PASSWORD_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...fromBrowser(testApp.app), authorization },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  const companiesQuery = '{ coreCompanies { id } }';

  it('E05-S08 a user created with a temporary password gets core.password_change_required on any GraphQL request', async () => {
    const { email, temporaryPassword } = await temporaryUser();
    const authorization = await jwtOf(email, temporaryPassword);

    const answer = await gqlClient(url, { headers: { authorization } }).send(companiesQuery);

    expect(answer.data ?? null).toBeNull();
    expect(answer.errors?.[0]?.extensions).toMatchObject({
      code: 'FORBIDDEN',
      errorCode: 'core.password_change_required',
    });
  });

  it('E05-S08 after setting a new password the same request succeeds', async () => {
    const { email, temporaryPassword } = await temporaryUser();
    const authorization = await jwtOf(email, temporaryPassword);

    const saved = await setNewPassword(authorization, temporaryPassword, 'a new password of mine');
    const answer = await gqlClient(url, { headers: { authorization } }).send(companiesQuery);

    expect(saved.status).toBe(200);
    expect(answer).toEqual({ status: 200, data: { coreCompanies: expect.any(Array) } });
    expect(await jwtOf(email, 'a new password of mine')).toMatch(/^Bearer \S+\.\S+\.\S+$/);
  });

  it('E05-S08 setting a new password ends every other session of the user, so a session opened with the temporary password mints no JWT, and the caller keeps theirs', async () => {
    const { email, temporaryPassword } = await temporaryUser();
    const callerSession = await sessionTokenOf({ email, password: temporaryPassword });
    const otherSession = await sessionTokenOf({ email, password: temporaryPassword });
    const caller = await fetch(`${url}/api/auth/token`, {
      headers: { authorization: `Bearer ${callerSession}` },
    });
    const { token } = (await caller.json()) as { token: string };

    const saved = await setNewPassword(
      `Bearer ${token}`,
      temporaryPassword,
      'a new password of mine',
    );
    const [other, callerAgain] = await Promise.all(
      [otherSession, callerSession].map((session) =>
        fetch(`${url}/api/auth/token`, { headers: { authorization: `Bearer ${session}` } }),
      ),
    );

    expect(saved.status).toBe(200);
    expect(other?.status).toBe(401);
    expect(callerAgain?.status).toBe(200);
  });

  it('E05-S08 a new password equal to the temporary one, or shorter than 8 characters, is refused, and the request still needs a new password', async () => {
    const { email, temporaryPassword } = await temporaryUser();
    const authorization = await jwtOf(email, temporaryPassword);

    const same = await setNewPassword(authorization, temporaryPassword, temporaryPassword);
    const short = await setNewPassword(authorization, temporaryPassword, 'short');
    const wrong = await setNewPassword(authorization, `${temporaryPassword}x`, 'a new password');
    const answer = await gqlClient(url, { headers: { authorization } }).send(companiesQuery);

    expect([same.status, short.status, wrong.status]).toEqual([400, 400, 400]);
    expect([
      ((await same.json()) as { errorCode: string }).errorCode,
      ((await short.json()) as { errorCode: string }).errorCode,
      ((await wrong.json()) as { errorCode: string }).errorCode,
    ]).toEqual([
      'core.password_unchanged',
      'core.password_too_short',
      'core.current_password_wrong',
    ]);
    expect(answer.errors?.[0]?.extensions).toMatchObject({
      errorCode: 'core.password_change_required',
    });
  });

  it('E05-S08 the new password route needs a signed-in user', async () => {
    const answer = await setNewPassword('', 'anything', 'a new password');

    expect(answer.status).toBe(401);
  });

  /** A sign-in on /api/auth/sign-in/email from the client that `client` names. */
  function signInFrom(
    client: { readonly 'x-forwarded-for': string },
    email: string,
    password: string,
  ) {
    return fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...fromBrowser(testApp.app), ...client },
      body: JSON.stringify({ email, password }),
    });
  }

  /** An email that no user has. */
  const unknownEmail = () => `nobody_${randomUUIDv7().slice(-12)}@example.test`;

  it('B3 sign-in is throttled with NODE_ENV unset: a client gets 429 on its fourth try in 10 seconds, where Better Auth by default throttles only in production', async () => {
    // The test app runs with NODE_ENV test, which Better Auth, like an unset NODE_ENV, does not
    // count as production.
    const client = fromNewClient();

    const responses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      responses.push(await signInFrom(client, unknownEmail(), 'a wrong password'));
    }

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 429]);
    expect(Number(responses[3]?.headers.get('x-retry-after'))).toBeGreaterThan(0);
  });

  it('B3 two clients behind the trusted proxy are throttled apart', async () => {
    const { user } = await reader();
    const crowded = fromNewClient();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await signInFrom(crowded, unknownEmail(), 'a wrong password');
    }

    const fromCrowded = await signInFrom(crowded, user.email, user.password);
    const fromOther = await signInFrom(fromNewClient(), user.email, user.password);

    expect(fromCrowded.status).toBe(429);
    expect(fromOther.status).toBe(200);
    expect(fromOther.headers.get('set-auth-token')).toBeTruthy();
  });

  it(`B3 an account locks after ${SIGN_IN_LOCKOUT_FAILURES} failed sign-ins, also against the right password, and unlocks after the window`, async () => {
    const { user } = await reader();
    for (let attempt = 0; attempt < SIGN_IN_LOCKOUT_FAILURES; attempt += 1) {
      const failed = await signInFrom(fromNewClient(), user.email, `${user.password}x`);
      expect(failed.status).toBe(401);
    }

    const locked = await signInFrom(fromNewClient(), user.email, user.password);
    const lockedBody = (await locked.json()) as { code?: string };
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + SIGN_IN_LOCKOUT_SECONDS * 1000 + 1000 });
    let unlocked: Response;
    try {
      unlocked = await signInFrom(fromNewClient(), user.email, user.password);
    } finally {
      vi.useRealTimers();
    }

    expect(locked.status).toBe(429);
    expect(locked.headers.get('set-auth-token')).toBeNull();
    expect(Number(locked.headers.get('x-retry-after'))).toBeGreaterThan(
      SIGN_IN_LOCKOUT_SECONDS - 60,
    );
    expect(lockedBody.code).toBe('ACCOUNT_LOCKED');
    expect(unlocked.status).toBe(200);
  });

  it(`B3 ${SIGN_IN_LOCKOUT_FAILURES} failed sign-ins at the same moment each count, so the account locks`, async () => {
    const { user } = await reader();
    await Promise.all(
      Array.from({ length: SIGN_IN_LOCKOUT_FAILURES }, () =>
        signInFrom(fromNewClient(), user.email, `${user.password}x`),
      ),
    );

    const locked = await signInFrom(fromNewClient(), user.email, user.password);

    expect(locked.status).toBe(429);
  });

  it('B3 a successful sign-in clears the failures before it, so only failures in a row lock', async () => {
    const { user } = await reader();
    const fail = () => signInFrom(fromNewClient(), user.email, `${user.password}x`);
    for (let attempt = 1; attempt < SIGN_IN_LOCKOUT_FAILURES; attempt += 1) await fail();
    const between = await signInFrom(fromNewClient(), user.email, user.password);
    for (let attempt = 1; attempt < SIGN_IN_LOCKOUT_FAILURES; attempt += 1) await fail();

    const after = await signInFrom(fromNewClient(), user.email, user.password);

    expect(between.status).toBe(200);
    expect(after.status).toBe(200);
  });

  it('B3 an email that no user has locks as an account does, so the lockout tells nobody which emails exist', async () => {
    const email = unknownEmail();
    for (let attempt = 0; attempt < SIGN_IN_LOCKOUT_FAILURES; attempt += 1) {
      await signInFrom(fromNewClient(), email, 'a wrong password');
    }

    const locked = await signInFrom(fromNewClient(), email.toUpperCase(), 'a wrong password');

    expect(locked.status).toBe(429);
    expect(((await locked.json()) as { code?: string }).code).toBe('ACCOUNT_LOCKED');
  });
});

describe('sign-in without a trusted proxy', () => {
  const db = useTestDatabase();
  let testApp: TestApp;
  let url: string;

  beforeAll(async () => {
    testApp = await createTestApp({
      modules: ['core'],
      hostFactory,
      database: db,
      env: { NORTHMES_TRUSTED_PROXY_HOPS: '0' },
    });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('B3 a client that names another address in X-Forwarded-For on each try is still throttled by its own address', async () => {
    const statuses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${url}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...fromBrowser(testApp.app),
          ...fromNewClient(),
        },
        body: JSON.stringify({
          email: `nobody_${randomUUIDv7().slice(-12)}@example.test`,
          password: 'a wrong password',
        }),
      });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([401, 401, 401, 429]);
  });
});
