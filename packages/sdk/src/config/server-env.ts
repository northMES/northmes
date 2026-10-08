// SPDX-License-Identifier: MIT
import { z } from 'zod';

/**
 * Makes a key's rule its error message, so a problem states the rule and never the value. Zod
 * reports a missing key with input undefined.
 */
function rule(text: string) {
  return {
    error: (issue: { input?: unknown }) =>
      issue.input === undefined ? `missing, must be ${text}` : `must be ${text}`,
  };
}

const PORT_RULE = 'an integer from 0 to 65535';

/** The environment of apps/server in every role (ADR 0060). */
export const serverEnvSchema = z.object({
  NORTHMES_ROLE: z.enum(['all', 'api', 'worker'], rule('all, api or worker')).optional(),
  PORT: z
    .string(rule(PORT_RULE))
    .refine((value) => /^\d+$/.test(value) && Number(value) <= 65535, rule(PORT_RULE))
    .transform(Number),
  NORTHMES_PUBLIC_ORIGIN: z.string(rule('an origin with no path')),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
