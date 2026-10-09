// SPDX-License-Identifier: AGPL-3.0-or-later

/** The sign-in page's path, outside the plant routes (D2, SI1; spec question 2). */
export const signInPath = '/sign-in';

/** The sign-in page's URL search. */
export interface SignInSearch {
  /** The page to return to after sign-in: a path on this origin with its search. */
  readonly redirect?: string;
  /** Set after Sign out, so the page says "You are signed out" (SI19). */
  readonly signedOut?: true;
}

/** Reads the sign-in page's search from the URL, dropping anything else. */
export function signInSearch(search: Readonly<Record<string, unknown>>): SignInSearch {
  return {
    ...(typeof search.redirect === 'string' ? { redirect: search.redirect } : {}),
    ...(search.signedOut === true ? { signedOut: true } : {}),
  };
}

/**
 * Where sign-in leads: the return path when it is a path on this origin other than the sign-in
 * page, else the root. A full URL or a protocol-relative one never leaves the web.
 */
export function returnPathOf({ redirect }: SignInSearch): string {
  if (redirect === undefined || !redirect.startsWith('/') || redirect.startsWith('//')) return '/';
  if (redirect.startsWith('/\\') || redirect.split(/[?#]/)[0] === signInPath) return '/';
  return redirect;
}
