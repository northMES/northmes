// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import type { CoreArticleGroupsQuery } from './article-groups.graphql.gen.ts';

export {
  CoreArticleGroupsDocument as CoreArticleGroups,
  type CoreArticleGroupsQuery,
  type CoreArticleGroupsQueryVariables,
} from './article-groups.graphql.gen.ts';

/** An article group as the list and the article form's select read it. */
export type ArticleGroupRow = CoreArticleGroupsQuery['coreArticleGroups']['edges'][number]['node'];

// The company's article groups by code, the active ones and with includeArchived the archived ones
// too: a company keeps a short list of groups, so one page of 100 holds them all. The Article
// groups list and the article form's Article group select read it. pnpm gen writes its typed
// document to article-groups.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreArticleGroups($includeArchived: Boolean) {
      coreArticleGroups(
        first: 100
        includeArchived: $includeArchived
        orderBy: [{ field: CODE, direction: ASC }]
      ) {
        totalCount
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
