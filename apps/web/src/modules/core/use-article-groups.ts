// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { useEffect } from 'react';
import { CoreArticleGroups } from './article-groups.graphql.ts';

/**
 * The company's article groups by code, the active ones and with includeArchived the archived ones
 * too, as CoreArticleGroups answers them. It reads the first page, then each next page until the
 * last, and adds its groups to the answer, so the Article groups list and the article form's
 * Article group select hold every group of the company.
 */
export function useArticleGroups(
  includeArchived: boolean,
  fetchPolicy?: 'cache-first' | 'cache-and-network',
) {
  const result = useQuery(CoreArticleGroups, { variables: { includeArchived }, fetchPolicy });
  const { data, fetchMore } = result;
  const pageInfo = data?.coreArticleGroups.pageInfo;
  const next = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
  useEffect(() => {
    if (!next) return;
    void fetchMore({
      variables: { after: next },
      updateQuery: (previous, { fetchMoreResult }) => ({
        coreArticleGroups: {
          ...fetchMoreResult.coreArticleGroups,
          edges: [...previous.coreArticleGroups.edges, ...fetchMoreResult.coreArticleGroups.edges],
        },
      }),
    });
  }, [next, fetchMore]);
  return result;
}
