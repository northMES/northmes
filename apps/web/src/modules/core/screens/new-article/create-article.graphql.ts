// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql, type TypedDocumentNode } from '@apollo/client';
import type { createArticle } from '@northmes/core-contracts';
import type { z } from 'zod';
import type { Article } from '../../article.graphql.ts';

// Hand-written types of the mutation, until GraphQL codegen writes them. The input comes from the
// command's contract, the source the SDK builds it from (ADR 0017).

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
