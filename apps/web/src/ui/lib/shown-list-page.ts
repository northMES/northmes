// SPDX-License-Identifier: AGPL-3.0-or-later

/** The part of a list's page that decides whether it can stand in for the next one. */
interface ListPage {
  readonly totalCount: number;
  readonly edges: readonly unknown[];
}

interface ShownListPageOptions<TPage extends ListPage> {
  /** The page of the current view, once it has loaded. */
  readonly page: TPage | undefined;
  /** The page of the view before, Apollo's previousData. */
  readonly previous: TPage | undefined;
  /** The current view's load failed. */
  readonly failed: boolean;
  /** The current view has a search. */
  readonly searching: boolean;
}

/**
 * The page a list shows (design ui-222, LI7): the loaded page, or while the next search, sort,
 * filter or page loads, the page before, so the list keeps its rows, or keeps its filtered empty
 * state (ST17) while one search follows another. Without a page to keep (the first load, an error,
 * or a view before without rows that the current view would show as first run, such as after Clear
 * filters), the list shows its loading state (ST2).
 */
export function shownListPage<TPage extends ListPage>({
  page,
  previous,
  failed,
  searching,
}: ShownListPageOptions<TPage>): TPage | undefined {
  if (page !== undefined) return page;
  if (failed || previous === undefined) return undefined;
  if (previous.edges.length > 0) return previous;
  return searching && previous.totalCount === 0 ? previous : undefined;
}
