// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { useCallback, useEffect, useState } from 'react';
import { CoreArticleGroups } from './article-groups.graphql.ts';

/**
 * The company's article groups by code, the active ones and with includeArchived the archived ones
 * too, as CoreArticleGroups answers them. It reads the first page, then each next page until the
 * last, and adds its groups to the answer, so the Article groups list and the article form's
 * Article group select hold every group of the company. A next page that fails to load is
 * `pageError` until `retryPage` loads it; the groups already loaded stay.
 */
export function useArticleGroups(
  includeArchived: boolean,
  fetchPolicy?: 'cache-first' | 'cache-and-network',
) {
  const result = useQuery(CoreArticleGroups, { variables: { includeArchived }, fetchPolicy });
  const { data, fetchMore } = result;
  const [pageError, setPageError] = useState<unknown>();
  const pageInfo = data?.coreArticleGroups.pageInfo;
  const next = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
  const loadPage = useCallback(
    (after: string) =>
      fetchMore({
        variables: { after },
        updateQuery: (previous, { fetchMoreResult }) => ({
          coreArticleGroups: {
            ...fetchMoreResult.coreArticleGroups,
            edges: [
              ...previous.coreArticleGroups.edges,
              ...fetchMoreResult.coreArticleGroups.edges,
            ],
          },
        }),
      }).then(
        () => setPageError(undefined),
        (error: unknown) => setPageError(error ?? new Error('The next page did not load')),
      ),
    [fetchMore],
  );
  useEffect(() => {
    if (next) void loadPage(next);
  }, [next, loadPage]);
  const retryPage = useCallback(
    () => (next ? loadPage(next) : Promise.resolve()),
    [next, loadPage],
  );
  return { ...result, pageError, retryPage };
}
