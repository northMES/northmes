// SPDX-License-Identifier: AGPL-3.0-or-later
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
        version
        archivedAt
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
