// SPDX-License-Identifier: AGPL-3.0-or-later
import { type StockUnitCode, stockUnitCodes } from '@northmes/contracts';
import { z } from 'zod';

/** The page size of the list (design ui-222, open question 15). */
export const articlePageSize = 25;

/**
 * The sort of the list in the URL's sort key: a column id, with a leading minus for descending
 * (design ui-222, URL keys). The default, Last changed newest first, stays out of the URL (A5).
 */
type ArticleSort = 'code' | '-code' | 'name' | '-name' | 'changed';

/** The default sort, Last changed newest first (design ui-222, A5). */
const defaultSort = '-changed';

/** The sort field of coreArticles behind each column id. */
const sortFields = { code: 'CODE', name: 'NAME', changed: 'UPDATED_AT' } as const;

/** The token of the empty value in a filter key: no article group. */
export const noArticleGroup = 'none';

/** The token of the empty value in the source key: an article created in NorthMES. */
export const northmesSource = 'NorthMES';

/** The filter fields of the list that Group by groups by (design ui-222, LI29). */
export type ArticleGroupKey = 'articleGroup' | 'stockUnit' | 'source';

/**
 * The view of the articles list that lives in the URL (plan 06, View state in the URL): the search
 * in q, the sort, Show archived in archived=1, the filters in articleGroup, stockUnit and source,
 * each a comma list of the picked values, Group by in group, and the page counter with the cursor
 * of a page after the first, in after for a page reached forward and in before for one reached
 * backward (design ui-222, URL keys). Defaults stay out.
 */
export interface ArticleListSearch {
  readonly q?: string;
  readonly sort?: ArticleSort;
  /** Show archived (design ui-222, LI31): 1 lists archived articles too. */
  readonly archived?: 1;
  /** The picked groups by id, none for no group (LI3). */
  readonly articleGroup?: readonly string[];
  /** The picked stock units by code (LI17). */
  readonly stockUnit?: readonly StockUnitCode[];
  /** The picked sources by name, NorthMES for the articles created in NorthMES. */
  readonly source?: readonly string[];
  /** The filter field the list groups by (LI29). */
  readonly group?: ArticleGroupKey;
  /** The 1-based page counter behind "Rows 26 to 50 of 60", from 2 and only with a cursor. */
  readonly page?: number;
  readonly after?: string;
  readonly before?: string;
}

/**
 * A filter key's comma list of picked values, or a validated view's list: each value that does
 * not apply drops on its own,
 * the same value counts once, and a list with none left falls back to every value.
 */
function commaList<Value extends string>(
  value: z.ZodType<Value>,
  canonical: (each: string) => string = (each) => each,
) {
  return z
    .unknown()
    .transform((raw): Value[] | undefined => {
      // The URL holds a comma list; a view the route already validated holds the list itself.
      const values = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : [];
      const picked = [...new Set(values.map((each) => canonical(String(each))))].filter(
        (each): each is Value => value.safeParse(each).success,
      );
      return picked.length === 0 ? undefined : picked;
    })
    .catch(undefined);
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
  sort: z.enum(['code', '-code', 'name', '-name', 'changed']).optional().catch(undefined),
  archived: z
    .union([z.literal(1), z.literal('1')])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined),
  // The API compares group ids as text, which Postgres prints in lowercase, and NorthMES stands
  // for no source in any case, so a hand-edited link filters as its canonical values do.
  articleGroup: commaList(z.union([z.uuid(), z.literal(noArticleGroup)]), (each) =>
    each.toLowerCase(),
  ),
  stockUnit: commaList(z.enum(stockUnitCodes)),
  source: commaList(z.string().min(1).max(64), (each) =>
    each.toLowerCase() === northmesSource.toLowerCase() ? northmesSource : each,
  ),
  group: z.enum(['articleGroup', 'stockUnit', 'source']).optional().catch(undefined),
  page: z.coerce.number().int().min(2).optional().catch(undefined),
  after: z.string().min(1).optional().catch(undefined),
  before: z.string().min(1).optional().catch(undefined),
});

/**
 * The search, the sort, Show archived, the filters and Group by of a view, which every change but
 * paging keeps.
 */
function query({
  q,
  sort,
  archived,
  articleGroup,
  stockUnit,
  source,
  group,
}: ArticleListSearch): ArticleListSearch {
  return {
    ...(q !== undefined && { q }),
    ...(sort !== undefined && { sort }),
    ...(archived !== undefined && { archived }),
    ...(articleGroup !== undefined && articleGroup.length > 0 && { articleGroup }),
    ...(stockUnit !== undefined && stockUnit.length > 0 && { stockUnit }),
    ...(source !== undefined && source.length > 0 && { source }),
    ...(group !== undefined && { group }),
  };
}

/**
 * The URL's search of a view, as the router writes it: each filter as a comma list, such as
 * articleGroup=<id>,none.
 */
export function urlSearchOf(view: ArticleListSearch): Record<string, unknown> {
  const { articleGroup, stockUnit, source, ...rest } = view;
  return {
    ...rest,
    ...(articleGroup !== undefined && { articleGroup: articleGroup.join(',') }),
    ...(stockUnit !== undefined && { stockUnit: stockUnit.join(',') }),
    ...(source !== undefined && { source: source.join(',') }),
  };
}

/** The view with one filter's picks, from the first page; no picks removes the filter. */
export function filteredBy<Key extends 'articleGroup' | 'stockUnit' | 'source'>(
  view: ArticleListSearch,
  key: Key,
  picked: NonNullable<ArticleListSearch[Key]>,
): ArticleListSearch {
  return query({ ...view, [key]: picked.length === 0 ? undefined : picked });
}

/** The view without filters, from the first page, keeping its search, sort and grouping. */
export function unfiltered(view: ArticleListSearch): ArticleListSearch {
  return query({ ...view, articleGroup: undefined, stockUnit: undefined, source: undefined });
}

/** Whether the view filters by any field. */
export function isFiltered(view: ArticleListSearch): boolean {
  return (
    view.articleGroup !== undefined || view.stockUnit !== undefined || view.source !== undefined
  );
}

/** The view grouped by a filter field, or not grouped, from the first page. */
export function groupedBy(
  view: ArticleListSearch,
  group: ArticleGroupKey | undefined,
): ArticleListSearch {
  return query({ ...view, group });
}

/**
 * The filter variables of coreArticles and coreArticleFacets for the view: none as a null group
 * and NorthMES as a null source. A filter the view leaves out stays out.
 */
export function articleFilterVariables(view: ArticleListSearch) {
  return {
    ...(view.q !== undefined && { search: view.q }),
    ...(view.archived !== undefined && { includeArchived: true }),
    ...(view.articleGroup !== undefined && {
      articleGroupIds: view.articleGroup.map((id) => (id === noArticleGroup ? null : id)),
    }),
    ...(view.stockUnit !== undefined && { stockUnits: [...view.stockUnit] }),
    ...(view.source !== undefined && {
      sources: view.source.map((name) => (name === northmesSource ? null : name)),
    }),
  };
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
  return query({ ...view, sort: sort === defaultSort ? undefined : (sort as ArticleSort) });
}

/** The view searching for text, from the first page; an empty text clears the search. */
export function searchedFor(view: ArticleListSearch, text: string): ArticleListSearch {
  return query({ ...query(view), q: text === '' ? undefined : text });
}

/** The view with archived articles shown or hidden, from the first page. */
export function showingArchived(view: ArticleListSearch, shown: boolean): ArticleListSearch {
  return query({ ...view, archived: shown ? 1 : undefined });
}

/** The view's first page, with the same search, sort and Show archived. */
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
  const sort: string = view.sort ?? defaultSort;
  const desc = sort.startsWith('-');
  return { id: desc ? sort.slice(1) : sort, desc };
}

/**
 * The variables of coreArticles for the view: 25 rows forward from after, or back from before.
 * TypeScript infers their type, and the articles screen's useQuery checks it against the generated
 * variables of CoreArticles, so a sort field the schema drops fails the typecheck there.
 */
export function articleListVariables(view: ArticleListSearch) {
  const { id, desc } = sortOf(view);
  const field = sortFields[id as keyof typeof sortFields] ?? 'UPDATED_AT';
  const orderBy = [{ field, direction: desc ? 'DESC' : 'ASC' }] as const;
  const paging =
    view.before !== undefined
      ? { last: articlePageSize, before: view.before }
      : { first: articlePageSize, ...(view.after !== undefined && { after: view.after }) };
  return { ...paging, orderBy, ...articleFilterVariables(view) };
}

/**
 * The variables of coreArticles for one group of a grouped view: up to 100 rows of the group's
 * value in the view's order, under the view's search and filters.
 */
export function groupRowsVariables(view: ArticleListSearch, value: string) {
  const { orderBy } = articleListVariables(firstPageOf(view));
  const key = view.group ?? 'articleGroup';
  return {
    first: 100,
    orderBy,
    ...articleFilterVariables(filteredBy(view, key, [value] as never)),
  };
}
