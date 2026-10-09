// SPDX-License-Identifier: AGPL-3.0-or-later
import { createAuthClient } from 'better-auth/client';
import { jwtClient } from 'better-auth/client/plugins';

/** Where Better Auth answers below the API's URL. */
const authPath = 'api/auth';

/** The key of the session in the tab's storage. */
const storageKey = 'northmes.session';

/** How long before a JWT expires the session mints the next one, in milliseconds. */
const renewBeforeMs = 30_000;

/** The signed-in person, as the user menu shows them. */
export interface SignedInUser {
  readonly name: string;
  readonly username: string;
}

/** What a sign-in came to. A refusal names its reason, which the sign-in page words. */
export type SignInResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'wrong-credentials' | 'blocked' | 'failed' }
  | { readonly ok: false; readonly reason: 'rate-limited'; readonly retryAfterSeconds: number };

/**
 * The web's session with the API (#391): Better Auth's session token, which the bearer plugin
 * hands out in set-auth-token, and the short-lived JWT that the API takes as its bearer token,
 * minted from the session token at /api/auth/token.
 */
export interface AuthSession {
  /** The signed-in user, or undefined when nobody is signed in in this tab. */
  user(): SignedInUser | undefined;
  /**
   * Signs in with an email and a password. The API's username sign-in is disabled: a user signs in
   * on the web with their email only.
   */
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Ends the session at the API and forgets it in this tab. */
  signOut(): Promise<void>;
  /** Forgets the session in this tab, as after a 401, without calling the API. */
  forget(): void;
  /**
   * The JWT for the next API request, or undefined when nobody is signed in or the API refused to
   * mint one. It reuses the last JWT until 30 seconds before it expires.
   */
  token(): Promise<string | undefined>;
}

export interface AuthSessionOptions {
  /** The URL of the API, from config.json; Better Auth answers at <apiUrl>/api/auth. */
  readonly apiUrl: string;
  /**
   * Where the session token and the user live: sessionStorage in the browser, so the session
   * survives a reload of the tab and ends with the tab.
   */
  readonly storage: Storage;
  /** Replaces the global fetch, for tests. */
  readonly fetch?: typeof globalThis.fetch;
  /** Replaces Date.now, for tests. */
  readonly now?: () => number;
}

/** What the tab's storage holds while someone is signed in. */
interface StoredSession {
  readonly token: string;
  readonly user: SignedInUser;
}

/** A JWT and when it expires, in milliseconds since the epoch. */
interface Jwt {
  readonly token: string;
  readonly expiresAt: number;
}

/**
 * Better Auth's endpoints for the session: sign-in, the JWT and sign-out. The requests omit
 * credentials, which Better Auth's client would otherwise include: the browser then neither sends
 * nor stores Better Auth's session cookie, which would outlive the tab, and the bearer header
 * alone carries the session.
 */
function authClientFor({ apiUrl, fetch }: AuthSessionOptions, sessionToken: () => string) {
  return createAuthClient({
    baseURL: new URL(authPath, apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`).href,
    plugins: [jwtClient()],
    fetchOptions: {
      credentials: 'omit',
      auth: { type: 'Bearer', token: sessionToken },
      ...(fetch === undefined ? {} : { customFetchImpl: fetch }),
    },
  });
}

/** The session the tab's storage holds, or undefined when it holds none or something else. */
function readStored(storage: Storage): StoredSession | undefined {
  try {
    const stored: unknown = JSON.parse(storage.getItem(storageKey) ?? 'null');
    if (typeof stored !== 'object' || stored === null) return undefined;
    const { token, user } = stored as Partial<StoredSession>;
    if (typeof token !== 'string' || typeof user?.name !== 'string') return undefined;
    if (typeof user.username !== 'string') return undefined;
    return { token, user: { name: user.name, username: user.username } };
  } catch {
    return undefined;
  }
}

/**
 * When a JWT expires by the browser's clock, in milliseconds: `requestedAt`, when the session asked for it, plus its lifetime, exp
 * minus iat. The server's clock signs both claims, so a terminal whose clock runs behind or ahead
 * of the server's still renews the JWT 30 seconds before the server counts it expired. 0 when the
 * JWT carries no exp or iat, so the next token() mints again.
 */
function expiryOf(token: string, requestedAt: number): number {
  try {
    const payload = token.split('.')[1] ?? '';
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/');
    const { exp, iat } = JSON.parse(atob(base64)) as { exp?: unknown; iat?: unknown };
    if (typeof exp !== 'number' || typeof iat !== 'number') return 0;
    return requestedAt + (exp - iat) * 1000;
  } catch {
    return 0;
  }
}

/** A sign-in refusal by its HTTP status and Better Auth's error code. */
function refusal(status: number, code: string | undefined, retryAfter: string | null) {
  if (status === 429) {
    const seconds = Number(retryAfter);
    return {
      ok: false,
      reason: 'rate-limited',
      retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 10,
    } as const;
  }
  if (code === 'BANNED_USER') return { ok: false, reason: 'blocked' } as const;
  if (status === 401 || status === 400) return { ok: false, reason: 'wrong-credentials' } as const;
  return { ok: false, reason: 'failed' } as const;
}

/**
 * Creates the tab's auth session. The session token is the long-lived credential: it mints JWTs
 * for as long as the session lives. It stays in the tab's storage, never in localStorage, so it
 * ends with the tab and another tab signs in on its own.
 */
export function createAuthSession(options: AuthSessionOptions): AuthSession {
  const { storage, now = Date.now } = options;
  let stored = readStored(storage);
  let jwt: Jwt | undefined;
  let minting: Promise<Jwt | undefined> | undefined;
  const client = authClientFor(options, () => stored?.token ?? '');

  const forget = () => {
    stored = undefined;
    jwt = undefined;
    minting = undefined;
    storage.removeItem(storageKey);
  };

  const mint = async (): Promise<Jwt | undefined> => {
    const requestedAt = now();
    const { data } = await client.token();
    if (data === null || typeof data.token !== 'string') return undefined;
    return { token: data.token, expiresAt: expiryOf(data.token, requestedAt) };
  };

  return {
    user: () => stored?.user,

    async signIn(email, password) {
      forget();
      let token: string | null = null;
      let retryAfter: string | null = null;
      const hooks = {
        onSuccess: ({ response }: { response: Response }) => {
          token = response.headers.get('set-auth-token');
        },
        onError: ({ response }: { response: Response }) => {
          retryAfter = response.headers.get('x-retry-after');
        },
      };
      // Better Fetch rejects when the request never reaches the API, as on a lost connection.
      const answer = await client.signIn.email({ email, password }, hooks).catch(() => undefined);
      if (answer === undefined) return { ok: false, reason: 'failed' };
      const { data, error } = answer;
      if (error !== null) return refusal(error.status, error.code, retryAfter);
      const user = data?.user as { name?: unknown; username?: unknown } | undefined;
      const sessionToken = token ?? data?.token;
      if (typeof sessionToken !== 'string' || typeof user?.name !== 'string') {
        return { ok: false, reason: 'failed' };
      }
      stored = {
        token: sessionToken,
        user: {
          name: user.name,
          username: typeof user.username === 'string' ? user.username : email,
        },
      };
      storage.setItem(storageKey, JSON.stringify(stored));
      return { ok: true };
    },

    async signOut() {
      if (stored !== undefined) {
        // The tab forgets the session also when the API cannot be reached to end it.
        await client.signOut().catch(() => undefined);
      }
      forget();
    },

    forget,

    async token() {
      if (stored === undefined) return undefined;
      if (jwt !== undefined && jwt.expiresAt - renewBeforeMs > now()) return jwt.token;
      const session = stored;
      minting ??= mint().finally(() => {
        minting = undefined;
      });
      const minted = await minting;
      // A sign-out or another sign-in while the JWT was minted keeps its own state.
      if (stored !== session) return undefined;
      jwt = minted;
      return minted?.token;
    },
  };
}
