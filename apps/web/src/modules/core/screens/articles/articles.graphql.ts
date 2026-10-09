// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql, type TypedDocumentNode } from '@apollo/client';
import type { Article } from '../../article.graphql.ts';
import type { ArticlesVariables } from '../../article-list-search.ts';

// Hand-written types of the list query, until GraphQL codegen writes them. The variables live
// with the list's URL search, which builds them.

/** One page of the plant's articles. */
export interface ArticlesPage {
  readonly totalCount: number;
  readonly pageInfo: {
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
    readonly startCursor: string | null;
    readonly endCursor: string | null;
  };
  readonly edges: readonly { readonly cursor: string; readonly node: Article }[];
}

/** One page of the articles of the plant that the client's x-northmes-plant header names. */
export const CoreArticles: TypedDocumentNode<
  { readonly coreArticles: ArticlesPage },
  ArticlesVariables
> = gql`
  query CoreArticles(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $orderBy: [ArticleOrderBy!]
    $search: String
  ) {
    coreArticles(
      first: $first
      after: $after
      last: $last
      before: $before
      orderBy: $orderBy
      search: $search
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
        }
      }
    }
  }
`;
