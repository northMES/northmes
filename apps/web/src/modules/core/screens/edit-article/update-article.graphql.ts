// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql, type TypedDocumentNode } from '@apollo/client';
import type { updateArticle } from '@northmes/core-contracts';
import type { z } from 'zod';
import type { Article } from '../../article.graphql.ts';

// Hand-written types of the mutation, until GraphQL codegen writes them. The input comes from the
// command's contract, the source the SDK builds it from (ADR 0017).

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
