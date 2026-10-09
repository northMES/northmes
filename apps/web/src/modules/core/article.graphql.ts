// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql, type TypedDocumentNode } from '@apollo/client';

// Hand-written types of the article query, until GraphQL codegen writes them. The article's page,
// the edit page and the new article page's cache update all read it.

/** An article with the fields the articles pages show and the version an edit sends. */
export interface Article {
  readonly __typename: 'Article';
  readonly id: string;
  /** The article number, unique at the article's scope. */
  readonly code: string;
  readonly name: string;
  readonly version: number;
}

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
