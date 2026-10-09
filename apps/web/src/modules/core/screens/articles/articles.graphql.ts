// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreArticlesDocument as CoreArticles,
  type CoreArticlesQuery,
  type CoreArticlesQueryVariables,
} from './articles.graphql.gen.ts';

// One page of the articles of the plant that the client's x-northmes-plant header names: the active
// ones, and the archived ones too with includeArchived. pnpm gen writes its typed document to
// articles.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreArticles(
      $first: Int
      $after: String
      $last: Int
      $before: String
      $orderBy: [ArticleOrderBy!]
      $search: String
      $includeArchived: Boolean
    ) {
      coreArticles(
        first: $first
        after: $after
        last: $last
        before: $before
        orderBy: $orderBy
        search: $search
        includeArchived: $includeArchived
      ) {
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
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
