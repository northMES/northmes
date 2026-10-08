// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql, type TypedDocumentNode } from '@apollo/client';
import type { createArticle, updateArticle } from '@northmes/core-contracts';
import type { z } from 'zod';

// Hand-written types of the articles operations, until GraphQL codegen writes them. The mutation
// inputs come from the commands' contracts, the source the SDK builds them from (ADR 0017).

/** An article with the fields the articles pages show and the version an edit sends. */
export interface Article {
  readonly __typename: 'Article';
  readonly id: string;
  /** The article number, unique at the article's scope. */
  readonly code: string;
  readonly name: string;
  readonly version: number;
}

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

/** The article with this id at the plant, or null. */
export const CoreArticle: TypedDocumentNode<
  { readonly coreArticle: Article | null },
  { readonly id: string }
> = gql`
  query CoreArticle($id: ID!) {
    coreArticle(id: $id) {
      id
      code
      name
      version
    }
  }
`;

/** Creates an article at the plant through the command core.createArticle. */
export const CoreCreateArticle: TypedDocumentNode<
  { readonly coreCreateArticle: Article },
  { readonly input: z.input<typeof createArticle.input> }
> = gql`
  mutation CoreCreateArticle($input: CoreCreateArticleInput!) {
    coreCreateArticle(input: $input) {
      id
      code
      name
      version
    }
  }
`;

/**
 * Changes an article through the command core.updateArticle. The normalized cache merges the
 * answer into the article that the list and the article's page hold.
 */
export const CoreUpdateArticle: TypedDocumentNode<
  { readonly coreUpdateArticle: Article },
  { readonly input: z.input<typeof updateArticle.input> }
> = gql`
  mutation CoreUpdateArticle($input: CoreUpdateArticleInput!) {
    coreUpdateArticle(input: $input) {
      id
      code
      name
      version
    }
  }
`;
