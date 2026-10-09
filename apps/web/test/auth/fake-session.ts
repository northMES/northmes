// SPDX-License-Identifier: AGPL-3.0-or-later
import { vi } from 'vitest';
import type { AuthSession, SignedInUser, SignInResult } from '../../src/auth/auth-session.ts';

/** The user the fake session signs in: alex.lund with the password "correct horse". */
export const alex: SignedInUser = { name: 'Alex Lund', username: 'alex.lund' };

/**
 * An AuthSession in memory. alex.lund signs in with "correct horse" and gets the JWT "jwt-1";
 * rate.limited is refused for 7 seconds; anyone else gets wrong credentials.
 */
export function fakeSession({ signedIn = true }: { readonly signedIn?: boolean } = {}) {
  let user: SignedInUser | undefined = signedIn ? alex : undefined;
  const session = {
    user: () => user,
    signIn: vi.fn(async (login: string, password: string): Promise<SignInResult> => {
      if (login === 'rate.limited') {
        return { ok: false, reason: 'rate-limited', retryAfterSeconds: 7 };
      }
      if (login !== alex.username || password !== 'correct horse') {
        return { ok: false, reason: 'wrong-credentials' };
      }
      user = alex;
      return { ok: true };
    }),
    signOut: vi.fn(async () => {
      user = undefined;
    }),
    forget: vi.fn(() => {
      user = undefined;
    }),
    token: vi.fn(async () => (user === undefined ? undefined : 'jwt-1')),
  } satisfies AuthSession;
  return session;
}
