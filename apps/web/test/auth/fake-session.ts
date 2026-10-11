// SPDX-License-Identifier: AGPL-3.0-or-later
import { vi } from 'vitest';
import type {
  AuthSession,
  NewPasswordResult,
  SignedInUser,
  SignInResult,
} from '../../src/auth/auth-session.ts';

/** The user the fake session signs in: alex.lund with the password "correct horse". */
export const alex: SignedInUser = { name: 'Alex Lund', username: 'alex.lund' };

/** The email alex.lund signs in with. */
export const alexEmail = 'alex.lund@example.test';

/** Tove Lindqvist, whom an admin gave the temporary password "Rk7qTm3vXp9w". */
export const tove: SignedInUser = { name: 'Tove Lindqvist', username: 'tove.lindqvist' };

/** The email Tove Lindqvist signs in with. */
export const toveEmail = 'tove.lindqvist@example.test';

/** Tove Lindqvist's temporary password, which she must replace at sign-in. */
export const toveTemporaryPassword = 'Rk7qTm3vXp9w';

/** An email whose sign-in the fake session refuses for 7 seconds. */
export const rateLimitedEmail = 'rate.limited@example.test';

/**
 * An AuthSession in memory. alexEmail signs in with "correct horse" and gets the JWT "jwt-1";
 * toveEmail signs in with her temporary password and must set a new one, which needs 8 to 128
 * characters and differs from the temporary one; rateLimitedEmail is refused for 7 seconds; anyone
 * else gets wrong credentials.
 */
export function fakeSession({ signedIn = true }: { readonly signedIn?: boolean } = {}) {
  let user: SignedInUser | undefined = signedIn ? alex : undefined;
  const session = {
    user: () => user,
    signIn: vi.fn(async (email: string, password: string): Promise<SignInResult> => {
      if (email === toveEmail && password === toveTemporaryPassword) {
        user = tove;
        return { ok: true, newPasswordRequired: true };
      }
      if (email === rateLimitedEmail) {
        return { ok: false, reason: 'rate-limited', retryAfterSeconds: 7 };
      }
      if (email !== alexEmail || password !== 'correct horse') {
        return { ok: false, reason: 'wrong-credentials' };
      }
      user = alex;
      return { ok: true };
    }),
    signOut: vi.fn(async () => {
      // As AuthSession, the tab forgets the user once the API has answered the sign-out.
      await new Promise((resolve) => setTimeout(resolve));
      user = undefined;
    }),
    forget: vi.fn(() => {
      user = undefined;
    }),
    token: vi.fn(async () => (user === undefined ? undefined : 'jwt-1')),
    setNewPassword: vi.fn(
      async (currentPassword: string, newPassword: string): Promise<NewPasswordResult> => {
        if (newPassword.length < 8) return { ok: false, reason: 'too-short' };
        if (newPassword.length > 128) return { ok: false, reason: 'too-long' };
        if (newPassword === currentPassword) return { ok: false, reason: 'unchanged' };
        return { ok: true };
      },
    ),
  } satisfies AuthSession;
  return session;
}
