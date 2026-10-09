// SPDX-License-Identifier: AGPL-3.0-or-later
import { apiKey } from '@better-auth/api-key';
import type { BetterAuthOptions } from 'better-auth';
import { admin, bearer, jwt, organization, username } from 'better-auth/plugins';
import type { Dialect } from 'kysely';

/** The schema that holds Better Auth's tables, which core's migrations create (ADR 0010). */
export const AUTH_SCHEMA = 'auth';

/** Where Better Auth's handler answers on the Nest app. */
export const AUTH_BASE_PATH = '/api/auth';

/** How long a JWT for the web lives. The web gets a new one from /api/auth/token. */
export const JWT_LIFETIME = '5m';

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
 * SESSION_LIFETIME_SECONDS. Sign-up is disabled, ids are uuids and the tables are in the
 * auth schema. The same options build the runtime instance and core's migration, and the drift
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
    rateLimit: { storage: 'database' },
    telemetry: { enabled: false },
    advanced: {
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
      jwt({
        jwt: {
          expirationTime: JWT_LIFETIME,
          // The subject is the user's id; the JWT carries nothing else about the user.
          definePayload: ({ session }) => ({ sid: session.id }),
        },
      }),
    ],
  } satisfies BetterAuthOptions;
}
