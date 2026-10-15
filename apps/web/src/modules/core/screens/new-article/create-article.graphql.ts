// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreCreateArticleDocument as CoreCreateArticle,
  type CoreCreateArticleMutation,
  type CoreCreateArticleMutationVariables,
} from './create-article.graphql.gen.ts';

// Creates an article of the company through the command core.createArticle, assigned to the plant
// or to the plants the input names. pnpm gen writes its
// typed document to create-article.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreCreateArticle($input: CoreCreateArticleInput!) {
      coreCreateArticle(input: $input) {
        id
        code
        name
        translations {
          field
          locale
          text
        }
        articleGroup {
          id
          code
          name
        }
        stockUnit
        note
        source
        version
        archivedAt
        createdAt
        updatedAt
        allPlants
        plants {
          id
          slug
          name
        }
      }
    }
  `;
}
