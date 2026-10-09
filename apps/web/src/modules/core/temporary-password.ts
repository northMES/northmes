// SPDX-License-Identifier: AGPL-3.0-or-later

// The temporary password of a user just created, kept in memory only, from Create user until the
// user's page shows it (design core-304, US17). It never goes to the URL, the history or storage.
const handed = new Map<string, string>();

/** Hands a new user's temporary password to the user's page, which shows it once. */
export function handOverTemporaryPassword(userId: string, password: string): void {
  handed.set(userId, password);
}

/** The temporary password handed over for the user, if any, without taking it. */
export function temporaryPasswordOf(userId: string): string | undefined {
  return handed.get(userId);
}

/** Forgets the user's temporary password once its dialog closed. */
export function forgetTemporaryPassword(userId: string): void {
  handed.delete(userId);
}
