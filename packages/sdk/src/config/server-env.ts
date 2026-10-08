// SPDX-License-Identifier: MIT
import { z } from 'zod';
import { nodeEnv, rule } from './keys.ts';

const PORT_RULE = 'an integer from 0 to 65535';
const ORIGIN_RULE =
  'an origin with no path, https:// in production, and in development and test also http://localhost or http://127.0.0.1 with a port';

/** Hosts a development or test origin may serve over http (ADR 0011, ADR 0044). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

function isPublicOrigin(value: string, env: z.infer<typeof nodeEnv>): boolean {
  const url = URL.parse(value);
  if (url === null) return false;
  if (url.protocol === 'https:') return true;
  return (
    env !== 'production' &&
    url.protocol === 'http:' &&
    LOOPBACK_HOSTS.has(url.hostname) &&
    url.port !== ''
  );
}

/** The environment of apps/server in every role (ADR 0060). */
export const serverEnvSchema = z
  .object({
    NODE_ENV: nodeEnv,
    NORTHMES_ROLE: z.enum(['all', 'api', 'worker'], rule('all, api or worker')).default('all'),
    PORT: z
      .string(rule(PORT_RULE))
      .refine((value) => /^\d+$/.test(value) && Number(value) <= 65535, rule(PORT_RULE))
      .transform(Number),
    NORTHMES_PUBLIC_ORIGIN: z.string(rule(ORIGIN_RULE)),
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
