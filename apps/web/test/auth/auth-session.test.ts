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
 * Better Auth's answers as the API gives them: alex.lund signs in by email with the password
 * "correct horse", gets the session token "session-1", and /token mints JWTs that live five
 * minutes from `clock.now`. Its username sign-in is disabled, so that path is not found.
 */
function betterAuth(clock: { now: number }) {
  const user = {
    id: 'user-1',
    name: 'Alex Lund',
    username: 'alex.lund',
    email: 'alex.lund@example.test',
  };
  let minted = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    const body = init?.body ?? (input instanceof Request ? await input.text() : undefined);
    const sent = typeof body === 'string' && body !== '' ? JSON.parse(body) : {};
    const signedIn = headers.get('authorization') === 'Bearer session-1';
    switch (url.pathname) {
      case '/mes/api/auth/sign-in/email': {
        if (sent.email === 'rate.limited@example.test') {
          return json(
            { message: 'Too many requests' },
            { status: 429, headers: { 'x-retry-after': '7' } },
          );
        }
        if (sent.email === 'banned.user@example.test') {
          return json({ code: 'BANNED_USER', message: 'You have been banned' }, { status: 403 });
        }
        if (sent.email === 'tove.lindqvist@example.test' && sent.password === 'Rk7qTm3vXp9w') {
          return json(
            {
              token: 'session-1',
              user: { ...user, name: 'Tove Lindqvist', username: 'tove', mustChangePassword: true },
            },
            { headers: { 'set-auth-token': 'session-1' } },
          );
        }
        if (sent.email !== user.email || sent.password !== 'correct horse') {
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
      case '/mes/api/account/password': {
        if (!/^Bearer \S+\.\S+\.signature$/.test(headers.get('authorization') ?? '')) {
          return json({ errorCode: 'core.unauthenticated' }, { status: 401 });
        }
        if (sent.newPassword.length < 8) {
          return json({ errorCode: 'core.password_too_short' }, { status: 400 });
        }
        if (sent.newPassword === sent.currentPassword) {
          return json({ errorCode: 'core.password_unchanged' }, { status: 400 });
        }
        return json({ ok: true });
      }
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
  it('E05-S05 a user signs in with email and password, and a reload of the tab keeps the user', async () => {
    const { open, api } = setup();
    const session = open();

    const result = await session.signIn('alex.lund@example.test', 'correct horse');

    expect(result).toEqual({ ok: true });
    expect(api.calls('/sign-in/email')).toHaveLength(1);
    expect(session.user()).toEqual({ name: 'Alex Lund', username: 'alex.lund' });
    expect(open().user()).toEqual({ name: 'Alex Lund', username: 'alex.lund' });
  });

  it('E05-S05 a login without an @ is sent to the email sign-in too, never to the username sign-in', async () => {
    const { open, api } = setup();

    const result = await open().signIn('alex.lund', 'correct horse');

    expect(result).toEqual({ ok: false, reason: 'wrong-credentials' });
    expect(api.calls('/sign-in/email')).toHaveLength(1);
    expect(api.calls('/sign-in/username')).toHaveLength(0);
  });

  it('E05-S05 a wrong password or an unknown user is wrong credentials, and nobody is signed in', async () => {
    const { open } = setup();
    const session = open();

    const wrong = await session.signIn('alex.lund@example.test', 'Correct horse');
    const unknown = await session.signIn('nobody@example.test', 'correct horse');

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

    expect(await session.signIn('rate.limited@example.test', 'x')).toEqual({
      ok: false,
      reason: 'rate-limited',
      retryAfterSeconds: 7,
    });
    expect(await session.signIn('banned.user@example.test', 'x')).toEqual({
      ok: false,
      reason: 'blocked',
    });
  });

  it('E05-S05 a sign-in that never reaches the API failed, so the page asks the user to check the connection', async () => {
    const { api, open } = setup();
    const session = open();
    api.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    expect(await session.signIn('alex.lund@example.test', 'correct horse')).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(session.user()).toBeUndefined();
  });

  it('E05-S05 token() mints a JWT with the session token, reuses it, and mints the next one 30 seconds before it expires', async () => {
    const { open, api, clock } = setup();
    const session = open();
    await session.signIn('alex.lund@example.test', 'correct horse');

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
    await session.signIn('alex.lund@example.test', 'correct horse');
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

    await session.signIn('alex.lund@example.test', 'correct horse');
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
    await session.signIn('alex.lund@example.test', 'correct horse');

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
    await session.signIn('alex.lund@example.test', 'correct horse');
    const before = api.fetch.mock.calls.length;

    session.forget();

    expect(api.fetch.mock.calls.length).toBe(before);
    expect(session.user()).toBeUndefined();
    expect(open().user()).toBeUndefined();
  });

  it('E05-S08 a sign-in with a temporary password says that the user must set a new password', async () => {
    const { open } = setup();
    const session = open();

    const temporary = await session.signIn('tove.lindqvist@example.test', 'Rk7qTm3vXp9w');
    const usual = await open().signIn('alex.lund@example.test', 'correct horse');

    expect(temporary).toEqual({ ok: true, newPasswordRequired: true });
    expect(usual).toEqual({ ok: true });
  });

  it('E05-S08 setNewPassword sends the temporary and the new password with the JWT, without cookies, and words a refusal by its code', async () => {
    const { open, api } = setup();
    const session = open();
    await session.signIn('tove.lindqvist@example.test', 'Rk7qTm3vXp9w');

    const short = await session.setNewPassword('Rk7qTm3vXp9w', 'short');
    const unchanged = await session.setNewPassword('Rk7qTm3vXp9w', 'Rk7qTm3vXp9w');
    const saved = await session.setNewPassword('Rk7qTm3vXp9w', 'a password of mine');

    expect([short, unchanged, saved]).toEqual([
      { ok: false, reason: 'too-short' },
      { ok: false, reason: 'unchanged' },
      { ok: true },
    ]);
    const [input, init] = api.calls('/api/account/password').at(-1) ?? [];
    expect(String(input)).toBe('https://api.northmes.test/mes/api/account/password');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(JSON.parse(String(init?.body))).toEqual({
      currentPassword: 'Rk7qTm3vXp9w',
      newPassword: 'a password of mine',
    });
  });
});
