// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';
import type { ArticleSortField, ArticlesVariables } from './screens/articles/index.ts';

/** The page size of the list (design ui-222, open question 15). */
export const articlePageSize = 25;

/**
 * The sort of the list in the URL's sort key: a column id, with a leading minus for descending.
 * The default, article number ascending, stays out of the URL.
 */
type ArticleSort = '-code' | 'name' | '-name';

/**
 * The view of the articles list that lives in the URL (plan 06, View state in the URL): the search
 * in q, the sort, and the page counter with the cursor of a page after the first, in after for a
 * page reached forward and in before for one reached backward. Defaults stay out.
 */
export interface ArticleListSearch {
  readonly q?: string;
  readonly sort?: ArticleSort;
  /** The 1-based page counter behind "Rows 26 to 50 of 60", from 2 and only with a cursor. */
  readonly page?: number;
  readonly after?: string;
  readonly before?: string;
}

/**
 * The URL keys, each of which falls back to its default on its own. The router parses each value
 * as JSON where it can, so a search for 2026 arrives as a number.
 */
const searchKeys = z.object({
  q: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().trim().min(1).max(100))
    .optional()
    .catch(undefined),
  sort: z.enum(['-code', 'name', '-name']).optional().catch(undefined),
  page: z.coerce.number().int().min(2).optional().catch(undefined),
  after: z.string().min(1).optional().catch(undefined),
  before: z.string().min(1).optional().catch(undefined),
});

/** The search and the sort of a view, which every change but paging keeps. */
function query({ q, sort }: ArticleListSearch): ArticleListSearch {
  return { ...(q !== undefined && { q }), ...(sort !== undefined && { sort }) };
}

/**
 * The view that a URL's search describes, for the route's validateSearch. A key that does not
 * apply falls back to its default, and a page counter without exactly one cursor, or a cursor
 * without a page counter, means the first page.
 */
export function articleListSearch(raw: Record<string, unknown>): ArticleListSearch {
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

/** The view sorted by a column, from the first page. */
export function sortedBy(
  view: ArticleListSearch,
  { id, desc }: { readonly id: string; readonly desc: boolean },
): ArticleListSearch {
  const sort = `${desc ? '-' : ''}${id}`;
  const { q } = query(view);
  return query({ q, sort: sort === 'code' ? undefined : (sort as ArticleSort) });
}

/** The view searching for text, from the first page; an empty text clears the search. */
export function searchedFor(view: ArticleListSearch, text: string): ArticleListSearch {
  return query({ ...query(view), q: text === '' ? undefined : text });
}

/** The view's first page, with the same search and sort. */
export function firstPageOf(view: ArticleListSearch): ArticleListSearch {
  return query(view);
}

/** The page after the one that ends at endCursor. */
export function nextPage(view: ArticleListSearch, endCursor: string): ArticleListSearch {
  return { ...query(view), page: (view.page ?? 1) + 1, after: endCursor };
}

/** The page before the one that starts at startCursor; the second page goes back to the first. */
export function previousPage(view: ArticleListSearch, startCursor: string): ArticleListSearch {
  const page = (view.page ?? 1) - 1;
  return page <= 1 ? query(view) : { ...query(view), page, before: startCursor };
}

/** The column and direction of the view's sort, for the table's sort headers. */
export function sortOf(view: Pick<ArticleListSearch, 'sort'>) {
  const sort: string = view.sort ?? 'code';
  const desc = sort.startsWith('-');
  return { id: desc ? sort.slice(1) : sort, desc };
}

const sortFields: Readonly<Record<string, ArticleSortField>> = { code: 'CODE', name: 'NAME' };

/** The variables of coreArticles for the view: 25 rows forward from after, or back from before. */
export function articleListVariables(view: ArticleListSearch): ArticlesVariables {
  const { id, desc } = sortOf(view);
  const orderBy = [{ field: sortFields[id] ?? 'CODE', direction: desc ? 'DESC' : 'ASC' }] as const;
  const paging =
    view.before !== undefined
      ? { last: articlePageSize, before: view.before }
      : { first: articlePageSize, ...(view.after !== undefined && { after: view.after }) };
  return { ...paging, orderBy, ...(view.q !== undefined && { search: view.q }) };
}
