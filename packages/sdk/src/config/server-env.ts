// SPDX-License-Identifier: MIT
import { z } from 'zod';
import { nodeEnv, rule } from './keys.ts';

const PORT_RULE = 'an integer from 0 to 65535';

/** The environment of apps/server in every role (ADR 0060). */
export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  NORTHMES_ROLE: z.enum(['all', 'api', 'worker'], rule('all, api or worker')).default('all'),
  PORT: z
    .string(rule(PORT_RULE))
    .refine((value) => /^\d+$/.test(value) && Number(value) <= 65535, rule(PORT_RULE))
    .transform(Number),
  NORTHMES_PUBLIC_ORIGIN: z.string(rule('an origin with no path')),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
