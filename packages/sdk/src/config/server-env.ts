// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { isIP } from 'node:net';
import { z } from 'zod';
import { configFile, databaseUrl, nodeEnv, rule, secretFile } from './keys.ts';

const PORT_RULE = 'an integer from 0 to 65535';
const LISTEN_HOST_RULE = 'an IPv4 or IPv6 address';
const PROXY_HOPS_RULE = 'an integer from 0 to 9';
const RATE_LIMIT_RULE = 'a positive integer of requests per minute';
const ORIGIN_RULE =
  'an origin with no path, https:// in production, and in development and test also http://localhost or http://127.0.0.1 with a port';

/** Hosts a development or test origin may serve over http (ADR 0011, ADR 0044). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

function isPublicOrigin(value: string, env: z.infer<typeof nodeEnv>): boolean {
  const url = URL.parse(value);
  // The same-origin check compares the Origin header with this value as a string, so a path, a
  // trailing slash or credentials would never match.
  if (url === null || url.origin !== value) return false;
  if (url.protocol === 'https:') return true;
  return (
    env !== 'production' &&
    url.protocol === 'http:' &&
    LOOPBACK_HOSTS.has(url.hostname) &&
    url.port !== ''
  );
}

/** A limit of requests per minute, written as a positive integer without sign or exponent. */
function rateLimit(fallback: string) {
  return z
    .string(rule(RATE_LIMIT_RULE))
    .refine((value) => /^[1-9]\d{0,8}$/.test(value), rule(RATE_LIMIT_RULE))
    .default(fallback)
    .transform(Number);
}

/** The environment of apps/backend in every role (ADR 0060). */
export const serverEnvSchema = z
  .object({
    NODE_ENV: nodeEnv,
    NORTHMES_ROLE: z.enum(['all', 'api', 'worker'], rule('all, api or worker')).default('all'),
    PORT: z
      .string(rule(PORT_RULE))
      .refine((value) => /^\d+$/.test(value) && Number(value) <= 65535, rule(PORT_RULE))
      .transform(Number),
    // The address the server listens on: the host only by default, and 0.0.0.0 in a container,
    // where only the proxy on the Compose network reaches it (ADR 0080).
    NORTHMES_LISTEN_HOST: z
      .string(rule(LISTEN_HOST_RULE))
      .refine((value) => isIP(value) !== 0, rule(LISTEN_HOST_RULE))
      .default('127.0.0.1'),
    // How many reverse proxies stand between the clients and the server, such as 1 for the Caddy
    // of the Compose bundle (ADR 0044). The server takes the client's address from the
    // X-Forwarded-For entry that the outermost of them wrote, and with 0 from the connection, so a
    // client that reaches the server directly cannot choose its address (#476).
    NORTHMES_TRUSTED_PROXY_HOPS: z
      .string(rule(PROXY_HOPS_RULE))
      .refine((value) => /^\d$/.test(value), rule(PROXY_HOPS_RULE))
      .default('0')
      .transform(Number),
    NORTHMES_PUBLIC_ORIGIN: z.string(rule(ORIGIN_RULE)),
    // The rate limits of the public REST API, per credential and minute, which an installation
    // turns on (ADR 0073 section 6): GET routes count as reads and POST routes as writes.
    NORTHMES_API_RATE_LIMIT: z.enum(['on', 'off'], rule('on or off')).default('off'),
    NORTHMES_API_RATE_LIMIT_READS: rateLimit('600'),
    NORTHMES_API_RATE_LIMIT_WRITES: rateLimit('60'),
    // The server logs in to DATABASE_URL as nm_app with the password in this file (ADR 0060).
    DATABASE_URL: databaseUrl,
    NORTHMES_DB_APP_PASSWORD_FILE: secretFile,
    // Better Auth's own pool logs in as nm_auth with the password in this file (ADR 0010).
    NORTHMES_DB_AUTH_PASSWORD_FILE: secretFile,
    // The secret Better Auth signs its cookies with and encrypts its JWT keys with (ADR 0010).
    NORTHMES_AUTH_SECRET_FILE: secretFile,
    NORTHMES_CONFIG: configFile,
  })
  .refine((env) => isPublicOrigin(env.NORTHMES_PUBLIC_ORIGIN, env.NODE_ENV), {
    ...rule(ORIGIN_RULE),
    path: ['NORTHMES_PUBLIC_ORIGIN'],
    // The origin rule depends on NODE_ENV. Checking it whenever both keys parsed lists it next
    // to problems in other keys.
    when: ({ issues }) =>
      !issues.some(
        ({ path }) => path?.[0] === 'NODE_ENV' || path?.[0] === 'NORTHMES_PUBLIC_ORIGIN',
      ),
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * The environment of the CLI's write commands, northmes company and northmes admin (ADR 0066, ADR
 * 0072): the server's database logins without PORT and NORTHMES_ROLE, since they listen on
 * nothing. Their work runs as nm_app under row-level security and Better Auth's writes run as
 * nm_auth, as in the server, and NORTHMES_PUBLIC_ORIGIN is the base URL of Better Auth.
 */
export const adminEnvSchema = z
  .object({
    NODE_ENV: nodeEnv,
    NORTHMES_PUBLIC_ORIGIN: z.string(rule(ORIGIN_RULE)),
    DATABASE_URL: databaseUrl,
    NORTHMES_DB_APP_PASSWORD_FILE: secretFile,
    NORTHMES_DB_AUTH_PASSWORD_FILE: secretFile,
    NORTHMES_AUTH_SECRET_FILE: secretFile,
    NORTHMES_CONFIG: configFile,
  })
  .refine((env) => isPublicOrigin(env.NORTHMES_PUBLIC_ORIGIN, env.NODE_ENV), {
    ...rule(ORIGIN_RULE),
    path: ['NORTHMES_PUBLIC_ORIGIN'],
    when: ({ issues }) =>
      !issues.some(
        ({ path }) => path?.[0] === 'NODE_ENV' || path?.[0] === 'NORTHMES_PUBLIC_ORIGIN',
      ),
  });

export type AdminEnv = z.infer<typeof adminEnvSchema>;
