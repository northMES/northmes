// SPDX-License-Identifier: MIT
import { z } from 'zod';

/**
 * Makes a key's rule its error message, so a problem states the rule and never the value. Zod
 * reports a missing key with input undefined.
 */
export function rule(text: string) {
  return {
    error: (issue: { input?: unknown }) =>
      issue.input === undefined ? `missing, must be ${text}` : `must be ${text}`,
  };
}

/** Read by every entry point. */
export const nodeEnv = z
  .enum(['development', 'test', 'production'], rule('development, test or production'))
  .default('production');

const DATABASE_URL_RULE = 'a postgres:// or postgresql:// URL with no user and no password';

function isDatabaseUrl(value: string): boolean {
  const url = URL.parse(value);
  return (
    url !== null &&
    (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
    url.username === '' &&
    url.password === '' &&
    // libpq also reads a login from the query string.
    !url.searchParams.has('user') &&
    !url.searchParams.has('password')
  );
}

/** The login comes from the entry point and its password from a secret file (ADR 0005). */
export const databaseUrl = z
  .string(rule(DATABASE_URL_RULE))
  .refine(isDatabaseUrl, rule(DATABASE_URL_RULE));

/** The path of a secret file. The value is read from the file, never from the environment. */
export const secretFile = z.string(rule('the path of a secret file'));
