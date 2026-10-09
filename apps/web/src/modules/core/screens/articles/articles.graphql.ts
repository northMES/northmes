// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql, type TypedDocumentNode } from '@apollo/client';
import type { Article } from '../../article.graphql.ts';

// Hand-written types of the list query, until GraphQL codegen writes them.

/** A sort field of coreArticles (ADR 0016). */
export type ArticleSortField = 'CODE' | 'NAME';

/** The arguments of coreArticles: one page forward (first, after) or backward (last, before). */
export interface ArticlesVariables {
  readonly first?: number;
  readonly after?: string;
  readonly last?: number;
  readonly before?: string;
  readonly orderBy: readonly {
    readonly field: ArticleSortField;
    readonly direction: 'ASC' | 'DESC';
  }[];
  readonly search?: string;
}

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
