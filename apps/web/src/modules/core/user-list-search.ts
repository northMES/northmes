// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/** The page size of the users list, as the articles list's. */
export const userPageSize = 25;

/**
 * The sort of the list in the URL's sort key: a column id, with a leading minus for descending
 * (design ui-222, URL keys). The default, Name ascending, stays out of the URL (core-304, US1).
 */
type UserSort = 'name' | '-name' | 'username' | '-username';

/** The default sort, Name ascending. */
const defaultSort = 'name';

/** The sort field of coreUsers behind each column id. */
const sortFields = { name: 'NAME', username: 'USERNAME' } as const;

/** The Status filter: active or blocked users (design core-304, US1). */
export type UserStatusFilter = 'active' | 'blocked';

/**
 * The Place filter in the URL (ADR 0091): anywhere, the company, the plant in the URL, or in
 * company settings another plant of the company by its slug. "plant" keeps the URL's plant across a
 * plant switch.
 */
export type UserPlace = 'anywhere' | 'company' | 'plant' | (string & {});

/**
 * The view of the users list that lives in the URL: the search in q, the Role filter's role id in
 * role, the Place filter in place, the Status filter in status, the sort, and the page counter with the cursor of a page after
 * the first, in after for a page reached forward and in before for one reached backward. Defaults
 * stay out.
 */
export interface UserListSearch {
  readonly q?: string;
  readonly role?: string;
  readonly place?: UserPlace;
  readonly status?: UserStatusFilter;
  readonly sort?: UserSort;
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
  role: z.uuid().optional().catch(undefined),
  place: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
    .optional()
    .catch(undefined),
  status: z.enum(['active', 'blocked']).optional().catch(undefined),
  sort: z.enum(['name', '-name', 'username', '-username']).optional().catch(undefined),
  page: z.coerce.number().int().min(2).optional().catch(undefined),
  after: z.string().min(1).optional().catch(undefined),
  before: z.string().min(1).optional().catch(undefined),
});

/** The search, the filters and the sort of a view, which every change but paging keeps. */
function query({ q, role, place, status, sort }: UserListSearch): UserListSearch {
  return {
    ...(q !== undefined && { q }),
    ...(role !== undefined && { role }),
    ...(place !== undefined && { place }),
    ...(status !== undefined && { status }),
    ...(sort !== undefined && sort !== defaultSort && { sort }),
  };
}

/**
 * The view that a URL's search describes, for the route's validateSearch. A key that does not
 * apply falls back to its default, and a page counter without exactly one cursor means the first
 * page.
 */
export function userListSearch(raw: Record<string, unknown>): UserListSearch {
  const { page, after, before, ...rest } = searchKeys.parse(raw);
  const view = query(rest);
  if (page !== undefined && after !== undefined && before === undefined) {
    return { ...view, page, after };
  }
  if (page !== undefined && before !== undefined && after === undefined) {
    return { ...view, page, before };
  }
  return view;
}

/** The view searching for text, from the first page; an empty text clears the search. */
export function usersSearchedFor(view: UserListSearch, text: string): UserListSearch {
  return query({ ...view, q: text === '' ? undefined : text });
}

/** The view of the holders of a role, or of every role, from the first page. */
export function usersWithRole(view: UserListSearch, role: string | undefined): UserListSearch {
  return query({ ...view, role });
}

/**
 * The view of the users with a role at a place, from the first page. The page's default place,
 * the plant at a plant and anywhere in company settings, stays out of the URL.
 */
export function usersAtPlace(
  view: UserListSearch,
  place: UserPlace,
  defaultPlace: UserPlace,
): UserListSearch {
  return query({ ...view, place: place === defaultPlace ? undefined : place });
}

/** The Place filter of a view, resolved where the page reads (ADR 0091). */
export interface PlaceFilter {
  /** The place the filter shows: the view's, or the default when the view's does not apply. */
  readonly place: UserPlace;
  /** The scope id of coreUsers' placeId, undefined for anywhere. */
  readonly placeId: string | undefined;
  /** The place needs an id the page has not loaded yet, so the list waits. */
  readonly pending: boolean;
}

/**
 * The Place filter of the view where the page reads: at a plant, anywhere, the company or the
 * plant, the default; in company settings, anywhere, the default, the company, the plant in the
 * URL or another plant by its slug. A place that does not apply falls back to the default.
 */
export function placeFilterOf(
  view: Pick<UserListSearch, 'place'>,
  {
    inCompany,
    plant,
    company,
    plants,
  }: {
    /** The page reads in company settings. */
    readonly inCompany: boolean;
    /** The slug of the plant in the URL. */
    readonly plant: string;
    readonly company: { readonly id: string } | undefined;
    /** The company's plants, empty until they load. */
    readonly plants: readonly { readonly id: string; readonly slug: string }[];
  },
): PlaceFilter {
  const fallback: UserPlace = inCompany ? 'anywhere' : 'plant';
  const asked = view.place ?? fallback;
  const plantAt = (slug: string): PlaceFilter => {
    const id = plants.find((each) => each.slug === slug)?.id;
    return { place: slug === plant ? 'plant' : slug, placeId: id, pending: id === undefined };
  };
  if (asked === 'anywhere') return { place: 'anywhere', placeId: undefined, pending: false };
  if (asked === 'company') {
    return { place: 'company', placeId: company?.id, pending: company === undefined };
  }
  if (asked === 'plant' || asked === plant) return plantAt(plant);
  // Another plant's slug: only in company settings, and only once the plants say it is one.
  if (inCompany && (plants.length === 0 || plants.some(({ slug }) => slug === asked))) {
    return plantAt(asked);
  }
  return placeFilterOf({ place: fallback }, { inCompany, plant, company, plants });
}

/** The view of active or blocked users, or of both, from the first page. */
export function usersWithStatus(
  view: UserListSearch,
  status: UserStatusFilter | undefined,
): UserListSearch {
  return query({ ...view, status });
}

/** The view without its search and filters, with the same sort. */
export function usersUnfiltered(view: UserListSearch): UserListSearch {
  return query({ sort: view.sort });
}

/** The view sorted by a column, from the first page. */
export function usersSortedBy(
  view: UserListSearch,
  { id, desc }: { readonly id: string; readonly desc: boolean },
): UserListSearch {
  return query({ ...view, sort: `${desc ? '-' : ''}${id}` as UserSort });
}

/** The column and direction of the view's sort, for the table's sort headers. */
export function userSortOf(view: Pick<UserListSearch, 'sort'>) {
  const sort: string = view.sort ?? defaultSort;
  const desc = sort.startsWith('-');
  return { id: desc ? sort.slice(1) : sort, desc };
}

/** The page after the one that ends at endCursor. */
export function nextUsersPage(view: UserListSearch, endCursor: string): UserListSearch {
  return { ...query(view), page: (view.page ?? 1) + 1, after: endCursor };
}

/** The page before the one that starts at startCursor; the second page goes back to the first. */
export function previousUsersPage(view: UserListSearch, startCursor: string): UserListSearch {
  const page = (view.page ?? 1) - 1;
  return page <= 1 ? query(view) : { ...query(view), page, before: startCursor };
}

/**
 * The variables of coreUsers for the view: 25 users, forward from after or back from before, by
 * name unless the view sorts otherwise, narrowed by the role, the place's scope id and the status.
 */
export function userListVariables(view: UserListSearch, placeId?: string) {
  const paging =
    view.before !== undefined
      ? { last: userPageSize, before: view.before }
      : { first: userPageSize, ...(view.after !== undefined && { after: view.after }) };
  const { id, desc } = userSortOf(view);
  const field = sortFields[id as keyof typeof sortFields] ?? 'NAME';
  const sorted = view.sort !== undefined && view.sort !== defaultSort;
  return {
    ...paging,
    ...(view.q !== undefined && { search: view.q }),
    ...(sorted && { orderBy: [{ field, direction: desc ? 'DESC' : 'ASC' }] as const }),
    ...(view.role !== undefined && { roleId: view.role }),
    ...(placeId !== undefined && { placeId }),
    ...(view.status !== undefined && { blocked: view.status === 'blocked' }),
  };
}
