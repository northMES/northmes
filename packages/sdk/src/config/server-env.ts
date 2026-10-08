// SPDX-License-Identifier: MIT
import { z } from 'zod';

/** The environment of apps/server in every role (ADR 0060). */
export const serverEnvSchema = z.object({
  PORT: z.string().transform(Number),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
