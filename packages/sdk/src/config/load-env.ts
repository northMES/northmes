// SPDX-License-Identifier: MIT
import type { z } from 'zod';
import { ConfigError } from './config-error.ts';

/**
 * Returns the validate function for an entry point's schema. It parses an environment record and
 * throws one ConfigError that lists every failing key with its rule.
 */
export function loadEnv<Schema extends z.ZodType>(
  schema: Schema,
): (record: Record<string, unknown>) => z.output<Schema> {
  return (record) => {
    const result = schema.safeParse(record);
    if (result.success) return result.data;
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  };
}
