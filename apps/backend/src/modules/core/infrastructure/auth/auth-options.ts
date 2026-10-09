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
 * The paths of the admin and api-key plugins. NorthMES calls them only on the server, through
 * auth.api from its own commands, so their HTTP paths are disabled (ADR 0011).
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
  '/api-key/verify',
  '/api-key/delete-all-expired-api-keys',
  '/is-username-available',
  '/sign-up/email',
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
 * Better Auth's options in NorthMES (ADR 0010): the username, organization, admin and api-key
 * plugins, and the bearer and jwt plugins that give the web a short-lived JWT, since the web and
 * the API may be on different origins. Sign-up is disabled, ids are uuids and the tables are in the
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
    rateLimit: { storage: 'database' },
    telemetry: { enabled: false },
    advanced: {
      database: { generateId: 'uuid' },
      defaultCookieAttributes: { sameSite: 'strict' },
    },
    plugins: [
      username(),
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
