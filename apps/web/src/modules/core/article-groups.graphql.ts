// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';
import type { CoreArticleGroupsQuery } from './article-groups.graphql.gen.ts';

export {
  CoreArticleGroupsDocument as CoreArticleGroups,
  type CoreArticleGroupsQuery,
  type CoreArticleGroupsQueryVariables,
} from './article-groups.graphql.gen.ts';

/** An article group as the list and the article form's select read it. */
export type ArticleGroupRow = CoreArticleGroupsQuery['coreArticleGroups']['edges'][number]['node'];

// One page of the company's article groups by code, the active ones and with includeArchived the
// archived ones too, after the cursor `after`. useArticleGroups reads every page, for the Article
// groups list and the article form's Article group select. pnpm gen writes its typed document to
// article-groups.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreArticleGroups($includeArchived: Boolean, $after: String) {
      coreArticleGroups(
        first: 100
        after: $after
        includeArchived: $includeArchived
        orderBy: [{ field: CODE, direction: ASC }]
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            code
            name
            version
            archivedAt
            updatedAt
          }
        }
      }
    }
  `;
}
