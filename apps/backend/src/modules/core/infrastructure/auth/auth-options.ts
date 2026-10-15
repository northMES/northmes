// SPDX-License-Identifier: AGPL-3.0-or-later
import { apiKey } from '@better-auth/api-key';
import type { BetterAuthOptions, BetterAuthPlugin } from 'better-auth';
import { admin, bearer, jwt, organization, username } from 'better-auth/plugins';
import type { Dialect } from 'kysely';
import { signInLockout } from './sign-in-lockout.ts';

export { SIGN_IN_LOCKOUT_FAILURES, SIGN_IN_LOCKOUT_SECONDS } from './sign-in-lockout.ts';

/** The schema that holds Better Auth's tables, which core's migrations create (ADR 0010). */
export const AUTH_SCHEMA = 'auth';

/** Where Better Auth's handler answers on the Nest app. */
export const AUTH_BASE_PATH = '/api/auth';

/**
 * The header that carries the client's address to Better Auth. AuthService sets it on every request
 * to /api/auth/* from req.ip, which follows NORTHMES_TRUSTED_PROXY_HOPS, and replaces any value the
 * client sent (#476). Better Auth reads no socket, only headers.
 */
export const CLIENT_ADDRESS_HEADER = 'x-northmes-client-address';

/** How long a JWT for the web lives. The web gets a new one from /api/auth/token. */
export const JWT_LIFETIME = '5m';

/**
 * How long Better Auth signs with one JWT key, in seconds: after 30 days the next JWT gets a new
 * key, and the old key still verifies the JWTs it signed (audit B12). Better Auth's own rotation
 * replaces a keyring of NorthMES's own (ADR 0047), since the keys live in auth.jwks encrypted with
 * the auth secret.
 */
export const JWT_KEY_ROTATION_SECONDS = 30 * 24 * 60 * 60;

/**
 * How long a session lives after sign-in or its last renewal, in seconds. The session token from
 * set-auth-token is the web's refresh token: it only mints the five-minute JWTs from
 * /api/auth/token, until the session expires or is revoked. The maintainer chose 12 hours, about a
 * shift, so an idle session ends while one in use stays open.
 */
export const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;

/** How old a session gets before a request renews its expiry, in seconds: an hour of use. */
export const SESSION_RENEWAL_SECONDS = 60 * 60;

/**
 * The paths of the admin and api-key plugins. NorthMES calls them only on the server, through
 * auth.api from its own commands, so their HTTP paths are disabled (ADR 0011). Sign-up, the
 * username check and /update-user are disabled too, and so is the username plugin's sign-in: a user
 * signs in on the web with email and password only, as the maintainer decided. A person without
 * email signs in with a badge at the operator station (ADR 0010).
 */
export const disabledPaths: readonly string[] = [
  '/admin/set-role',
  '/admin/get-user',
  '/admin/create-user',
  '/admin/update-user',
  '/admin/list-users',
  '/admin/list-user-sessions',
  '/admin/unban-user',
  '/admin/ban-user',
  '/admin/impersonate-user',
  '/admin/stop-impersonating',
  '/admin/revoke-user-session',
  '/admin/revoke-user-sessions',
  '/admin/remove-user',
  '/admin/set-user-password',
  '/admin/has-permission',
  '/api-key/create',
  '/api-key/get',
  '/api-key/update',
  '/api-key/delete',
  '/api-key/list',
  '/is-username-available',
  '/sign-in/username',
  '/sign-up/email',
  // Better Auth applies the bearer plugin's session only after every before hook has run, so the
  // username plugin's immutableUsername check finds no session on a bearer request and lets a
  // rename through. A user's own profile changes go through core's commands instead.
  '/update-user',
];

/**
 * The Better Auth routes that answer over HTTP: the ones the web calls, which are sign-in, the JWT
 * and sign-out. Every other route answers 404, the organization plugin's among them, which would
 * show a member every colleague's email and let them leave the company (ADR 0011). NorthMES calls
 * those plugins only on the server, through auth.api.
 */
export const openPaths: readonly string[] = ['/sign-in/email', '/sign-out', '/token'];

/**
 * Answers 404 for a request to any route outside openPaths, before the route runs. disabledPaths
 * alone is not enough: it matches exact paths, so it cannot close a route with a parameter such as
 * /callback/:id, and a route that a Better Auth upgrade adds would answer until someone listed it.
 */
function onlyOpenPaths(): BetterAuthPlugin {
  return {
    id: 'northmes-open-paths',
    onRequest: async (request) => {
      const { pathname } = new URL(request.url);
      if (openPaths.some((path) => pathname === `${AUTH_BASE_PATH}${path}`)) return;
      return { response: new Response('Not Found', { status: 404 }) };
    },
  };
}

export interface AuthOptionsInput {
  /** The database Better Auth reads and writes, through its own pool as nm_auth. */
  readonly dialect: Dialect;
  /** NORTHMES_PUBLIC_ORIGIN, the origin of the API, which also issues and audits the JWTs. */
  readonly baseURL: string;
  /** The secret that signs cookies and encrypts the JWT keys. */
  readonly secret: string;
  /** The origins of the web app, from webOrigins in northmes.config.json. */
  readonly webOrigins: readonly string[];
}

/**
 * Better Auth's options in NorthMES (ADR 0010): the username plugin for the never-reassigned
 * handle (its sign-in path is disabled), the organization, admin and api-key plugins, and the bearer and jwt plugins that give the web a short-lived JWT, since the web and
 * the API may be on different origins. The session token that mints the JWTs lives
 * SESSION_LIFETIME_SECONDS. Only openPaths answer over HTTP. Sign-up is disabled, ids are uuids and the tables are in the
 * auth schema. Sign-in is throttled per client address and an account locks after repeated
 * failures (#476). The same options build the runtime instance and core's migration, and the drift
 * test compares the two.
 */
export function authOptions({ dialect, baseURL, secret, webOrigins }: AuthOptionsInput) {
  return {
    appName: 'NorthMES',
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret,
    database: { dialect, type: 'postgres', schemaName: AUTH_SCHEMA },
    trustedOrigins: [baseURL, ...webOrigins],
    disabledPaths: [...disabledPaths],
    emailAndPassword: { enabled: true, disableSignUp: true },
    session: { expiresIn: SESSION_LIFETIME_SECONDS, updateAge: SESSION_RENEWAL_SECONDS },
    user: {
      additionalFields: {
        // Set with a temporary password that an admin hands out, cleared when the user sets their
        // own on the new password step (ADR 0051 rule 13). No client may set it.
        mustChangePassword: {
          type: 'boolean',
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    // On whatever NODE_ENV is: Better Auth's default throttles only in production, and NorthMES
    // treats an unset NODE_ENV as production (#476). Its rules apply per client address: 3
    // sign-ins in 10 seconds, and 100 requests in 10 seconds on the other paths.
    rateLimit: { enabled: true, storage: 'database' },
    telemetry: { enabled: false },
    advanced: {
      ipAddress: { ipAddressHeaders: [CLIENT_ADDRESS_HEADER] },
      database: { generateId: 'uuid' },
      defaultCookieAttributes: { sameSite: 'strict' },
    },
    plugins: [
      // A username is never reassigned (ADR 0010, ADR 0051). The flag guards a call that carries
      // the session cookie; /update-user is disabled over HTTP because a bearer request passes it.
      username({ immutableUsername: true }),
      organization({ allowUserToCreateOrganization: false }),
      admin(),
      apiKey(),
      bearer(),
      onlyOpenPaths(),
      signInLockout(),
      jwt({
        jwks: { rotationInterval: JWT_KEY_ROTATION_SECONDS },
        jwt: {
          expirationTime: JWT_LIFETIME,
          // The subject is the user's id; the JWT carries nothing else about the user.
          definePayload: ({ session }) => ({ sid: session.id }),
        },
      }),
    ],
  } satisfies BetterAuthOptions;
}
