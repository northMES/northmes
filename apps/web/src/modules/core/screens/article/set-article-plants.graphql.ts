// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreSetArticlePlantsDocument as CoreSetArticlePlants,
  type CoreSetArticlePlantsMutation,
  type CoreSetArticlePlantsMutationVariables,
} from './set-article-plants.graphql.gen.ts';

// Replaces the plants of an article, or assigns it to All plants, through the command
// core.setArticlePlants. pnpm gen writes its typed document to set-article-plants.graphql.gen.ts;
// this block never runs.
if (false) {
  gql`
    mutation CoreSetArticlePlants($input: CoreSetArticlePlantsInput!) {
      coreSetArticlePlants(input: $input) {
        id
        version
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
