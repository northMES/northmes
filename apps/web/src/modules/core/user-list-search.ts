// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

/** The page size of the users list, as the articles list's. */
export const userPageSize = 25;

/**
 * The view of the users list that lives in the URL: the search in q, and the page counter with
 * the cursor of a page after the first, in after for a page reached forward and in before for one
 * reached backward. Defaults stay out.
 */
export interface UserListSearch {
  readonly q?: string;
  readonly page?: number;
  readonly after?: string;
  readonly before?: string;
}

const searchKeys = z.object({
  q: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().trim().min(1).max(100))
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(2).optional().catch(undefined),
  after: z.string().min(1).optional().catch(undefined),
  before: z.string().min(1).optional().catch(undefined),
});

/**
 * The view that a URL's search describes, for the route's validateSearch. A key that does not
 * apply falls back to its default, and a page counter without exactly one cursor means the first
 * page.
 */
export function userListSearch(raw: Record<string, unknown>): UserListSearch {
  const { q, page, after, before } = searchKeys.parse(raw);
  const view = q === undefined ? {} : { q };
  if (page !== undefined && after !== undefined && before === undefined) {
    return { ...view, page, after };
  }
  if (page !== undefined && before !== undefined && after === undefined) {
    return { ...view, page, before };
  }
  return view;
}

/** The view searching for text, from the first page; an empty text clears the search. */
export function usersSearchedFor(text: string): UserListSearch {
  return text === '' ? {} : { q: text };
}

/** The page after the one that ends at endCursor. */
export function nextUsersPage(view: UserListSearch, endCursor: string): UserListSearch {
  return { ...usersSearchedFor(view.q ?? ''), page: (view.page ?? 1) + 1, after: endCursor };
}

/** The page before the one that starts at startCursor; the second page goes back to the first. */
export function previousUsersPage(view: UserListSearch, startCursor: string): UserListSearch {
  const page = (view.page ?? 1) - 1;
  const query = usersSearchedFor(view.q ?? '');
  return page <= 1 ? query : { ...query, page, before: startCursor };
}

/** The variables of coreUsers for the view: 25 users by name, forward from after or back from before. */
export function userListVariables(view: UserListSearch) {
  const paging =
    view.before !== undefined
      ? { last: userPageSize, before: view.before }
      : { first: userPageSize, ...(view.after !== undefined && { after: view.after }) };
  return { ...paging, ...(view.q !== undefined && { search: view.q }) };
}
