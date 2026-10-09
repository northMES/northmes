// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { createAuthSession } from '../../src/auth/auth-session.ts';

const apiUrl = 'https://api.northmes.test/mes';

/**
 * A JWT issued five minutes before `exp` that expires at `exp`, in seconds, as Better Auth's /token
 * signs it; the signature is not checked here.
 */
function jwtExpiringAt(exp: number, id: string): string {
  const part = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${part({ alg: 'EdDSA' })}.${part({ sub: 'user-1', iat: exp - 300, exp, id })}.signature`;
}

/** A Storage in memory, as sessionStorage is for one tab. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });

/**
 * Better Auth's answers as the API gives them: alex.lund signs in with the password
 * "correct horse", gets the session token "session-1", and /token mints JWTs that live five
 * minutes from `clock.now`.
 */
function betterAuth(clock: { now: number }) {
  const user = { id: 'user-1', name: 'Alex Lund', username: 'alex.lund', email: 'alex@x.invalid' };
  let minted = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    const body = init?.body ?? (input instanceof Request ? await input.text() : undefined);
    const sent = typeof body === 'string' && body !== '' ? JSON.parse(body) : {};
    const signedIn = headers.get('authorization') === 'Bearer session-1';
    switch (url.pathname) {
      case '/mes/api/auth/sign-in/username':
      case '/mes/api/auth/sign-in/email': {
        if (sent.username === 'rate.limited') {
          return json(
            { message: 'Too many requests' },
            { status: 429, headers: { 'x-retry-after': '7' } },
          );
        }
        if (sent.username === 'banned.user') {
          return json({ code: 'BANNED_USER', message: 'You have been banned' }, { status: 403 });
        }
        const known = sent.username === user.username || sent.email === user.email;
        if (!known || sent.password !== 'correct horse') {
          return json({ code: 'INVALID_USERNAME_OR_PASSWORD' }, { status: 401 });
        }
        return json({ token: 'session-1', user }, { headers: { 'set-auth-token': 'session-1' } });
      }
      case '/mes/api/auth/token':
        if (!signedIn) return json({ message: 'Unauthorized' }, { status: 401 });
        minted += 1;
        return json({ token: jwtExpiringAt(clock.now / 1000 + 300, `jwt-${minted}`) });
      case '/mes/api/auth/sign-out':
        return json({ success: true });
      default:
        return json({ message: 'Not found' }, { status: 404 });
    }
  });
  const calls = (path: string) =>
    fetch.mock.calls.filter(([input]) =>
      new URL(input instanceof Request ? input.url : String(input)).pathname.endsWith(path),
    );
  return { fetch, calls };
}

/** The id claim of a JWT, which names the JWT that betterAuth minted. */
const idOf = (jwt: string | undefined) =>
  jwt === undefined ? undefined : (JSON.parse(atob(jwt.split('.')[1] ?? '')) as { id: string }).id;

function setup() {
  const clock = { now: Date.UTC(2026, 9, 9, 8, 0, 0) };
  const api = betterAuth(clock);
  const storage = memoryStorage();
  const open = () => createAuthSession({ apiUrl, fetch: api.fetch, storage, now: () => clock.now });
  return { clock, api, storage, open };
}

describe('the auth session', () => {
  it('E05-S05 a user signs in with username and password, and a reload of the tab keeps the user', async () => {
    const { open } = setup();
    const session = open();

    const result = await session.signIn('alex.lund', 'correct horse');

    expect(result).toEqual({ ok: true });
    expect(session.user()).toEqual({ name: 'Alex Lund', username: 'alex.lund' });
    expect(open().user()).toEqual({ name: 'Alex Lund', username: 'alex.lund' });
  });

  it('E05-S05 a login with an @ signs in by email', async () => {
    const { open, api } = setup();

    const result = await open().signIn('alex@x.invalid', 'correct horse');

    expect(result).toEqual({ ok: true });
    expect(api.calls('/sign-in/email')).toHaveLength(1);
  });

  it('E05-S05 a wrong password or an unknown user is wrong credentials, and nobody is signed in', async () => {
    const { open } = setup();
    const session = open();

    const wrong = await session.signIn('alex.lund', 'Correct horse');
    const unknown = await session.signIn('nobody', 'correct horse');

    expect([wrong, unknown]).toEqual([
      { ok: false, reason: 'wrong-credentials' },
      { ok: false, reason: 'wrong-credentials' },
    ]);
    expect(session.user()).toBeUndefined();
    expect(await session.token()).toBeUndefined();
  });

  it('E05-S05 a rate-limited sign-in says how many seconds to wait, and a banned account is blocked', async () => {
    const { open } = setup();
    const session = open();

    expect(await session.signIn('rate.limited', 'x')).toEqual({
      ok: false,
      reason: 'rate-limited',
      retryAfterSeconds: 7,
    });
    expect(await session.signIn('banned.user', 'x')).toEqual({ ok: false, reason: 'blocked' });
  });

  it('E05-S05 a sign-in that never reaches the API failed, so the page asks the user to check the connection', async () => {
    const { api, open } = setup();
    const session = open();
    api.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    expect(await session.signIn('alex.lund', 'correct horse')).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(session.user()).toBeUndefined();
  });

  it('E05-S05 token() mints a JWT with the session token, reuses it, and mints the next one 30 seconds before it expires', async () => {
    const { open, api, clock } = setup();
    const session = open();
    await session.signIn('alex.lund', 'correct horse');

    const first = await session.token();
    const [again, together] = await Promise.all([session.token(), session.token()]);
    clock.now += 269_000;
    const stillFirst = await session.token();
    clock.now += 2_000;
    const next = await session.token();

    expect([first, again, together, stillFirst].map(idOf)).toEqual([
      'jwt-1',
      'jwt-1',
      'jwt-1',
      'jwt-1',
    ]);
    expect(idOf(next)).toBe('jwt-2');
    expect(api.calls('/token')).toHaveLength(2);
  });

  it('E05-S05 sign-out ends the session at the API and forgets the user and the JWT', async () => {
    const { open, api } = setup();
    const session = open();
    await session.signIn('alex.lund', 'correct horse');
    await session.token();

    await session.signOut();

    const [signOut] = api.calls('/sign-out');
    const [input, init] = signOut ?? [];
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    expect(headers.get('authorization')).toBe('Bearer session-1');
    expect(session.user()).toBeUndefined();
    expect(await session.token()).toBeUndefined();
    expect(open().user()).toBeUndefined();
  });

  it('E05-S05 sign-in, the JWT and sign-out go out without cookies, so the browser keeps no Better Auth cookie past the tab', async () => {
    const { open, api } = setup();
    const session = open();

    await session.signIn('alex.lund', 'correct horse');
    await session.token();
    await session.signOut();

    const credentials = api.fetch.mock.calls.map(([input, init]) =>
      input instanceof Request ? input.credentials : init?.credentials,
    );
    expect(credentials).toEqual(['omit', 'omit', 'omit']);
  });

  it("E05-S05 token() times the JWT by the browser's clock from the JWT's lifetime, so a clock behind the server renews it in time", async () => {
    const { open, api, clock } = setup();
    // The browser's clock runs two minutes behind the server's, which signs iat and exp.
    const behind = { now: clock.now - 120_000 };
    const session = createAuthSession({
      apiUrl,
      fetch: api.fetch,
      storage: memoryStorage(),
      now: () => behind.now,
    });
    await session.signIn('alex.lund', 'correct horse');

    const first = await session.token();
    clock.now += 271_000;
    behind.now += 271_000;
    const next = await session.token();

    expect(idOf(first)).toBe('jwt-1');
    expect(idOf(next)).toBe('jwt-2');
  });

  it('E05-S05 forget() drops the session in this tab without calling the API', async () => {
    const { open, api } = setup();
    const session = open();
    await session.signIn('alex.lund', 'correct horse');
    const before = api.fetch.mock.calls.length;

    session.forget();

    expect(api.fetch.mock.calls.length).toBe(before);
    expect(session.user()).toBeUndefined();
    expect(open().user()).toBeUndefined();
  });
});
