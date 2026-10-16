// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';

/** How many failed sign-ins in a row lock an account. */
export const SIGN_IN_LOCKOUT_FAILURES = 5;

/** How long a locked account stays locked after its last failed sign-in, in seconds. */
export const SIGN_IN_LOCKOUT_SECONDS = 15 * 60;

/** The table of failed sign-ins, one row per email, in the auth schema. */
const model = 'signInFailure';

/** A row of signInFailure: the failures in a row for one email and the time of the last one. */
interface Failures {
  readonly key: string;
  readonly count: number;
  readonly lastFailure: number | bigint | string;
}

/** The path whose failures count. Username sign-in is disabled (auth-options.ts). */
const signInPath = '/sign-in/email';

/** The email a sign-in names, as Better Auth compares it, or undefined for a body without one. */
function emailOf(body: unknown): string | undefined {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : undefined;
}

/**
 * The lockout per account of audit finding B3 (#476), the simple version that ADR 0051 B2 builds
 * on: after SIGN_IN_LOCKOUT_FAILURES failed sign-ins in a row, a sign-in with that email is refused
 * with 429, also with the right password, until SIGN_IN_LOCKOUT_SECONDS have passed since the last
 * failure. A successful sign-in clears the count. The count is kept per email, whether or not a
 * user has it, so a locked email tells nobody that an account exists. Better Auth has no lockout of
 * its own; its rate limit counts per client address, which a guesser who spreads the tries over
 * many addresses gets around.
 */
export function signInLockout() {
  return {
    id: 'sign-in-lockout',
    schema: {
      [model]: {
        fields: {
          key: { type: 'string', required: true, unique: true },
          count: { type: 'number', required: true },
          lastFailure: { type: 'number', bigint: true, required: true },
        },
      },
    },
    hooks: {
      before: [
        {
          matcher: (context) => context.path === signInPath,
          handler: createAuthMiddleware(async (ctx) => {
            const key = emailOf(ctx.body);
            if (key === undefined) return;
            const row = await ctx.context.adapter.findOne<Failures>({
              model,
              where: [{ field: 'key', value: key }],
            });
            if (!row || row.count < SIGN_IN_LOCKOUT_FAILURES) return;
            const unlocksAt = Number(row.lastFailure) + SIGN_IN_LOCKOUT_SECONDS * 1000;
            const now = Date.now();
            if (now >= unlocksAt) return;
            throw new APIError(
              'TOO_MANY_REQUESTS',
              {
                code: 'ACCOUNT_LOCKED',
                message: 'Too many failed sign-ins. Try again later.',
              },
              { 'X-Retry-After': String(Math.ceil((unlocksAt - now) / 1000)) },
            );
          }),
        },
      ],
      after: [
        {
          matcher: (context) => context.path === signInPath,
          handler: createAuthMiddleware(async (ctx) => {
            const key = emailOf(ctx.body);
            if (key === undefined) return;
            const { adapter } = ctx.context;
            const where = [{ field: 'key', value: key }];
            const returned = ctx.context.returned;
            if (!isAPIError(returned)) {
              await adapter.deleteMany({ model, where });
              return;
            }
            if (returned.statusCode !== 401) return;
            const now = Date.now();
            // Rows past the window lock nothing, so they go, this email's own too, which starts its
            // count again.
            await adapter.deleteMany({
              model,
              where: [
                {
                  field: 'lastFailure',
                  operator: 'lt',
                  value: now - SIGN_IN_LOCKOUT_SECONDS * 1000,
                },
              ],
            });
            // Atomic, so failures at the same moment each count: an increment of the row, or the
            // first row, or the increment again when another request wrote the first row meanwhile.
            const increment = () =>
              adapter.incrementOne({
                model,
                where,
                increment: { count: 1 },
                set: { lastFailure: now },
              });
            if (await increment()) return;
            const created = await adapter
              .create({ model, data: { key, count: 1, lastFailure: now } })
              .then(
                () => true,
                () => false,
              );
            if (!created) await increment();
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
