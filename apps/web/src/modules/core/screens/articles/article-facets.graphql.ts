// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';
import type { CoreArticleFacetsQuery } from './article-facets.graphql.gen.ts';

export {
  CoreArticleFacetsDocument as CoreArticleFacets,
  type CoreArticleFacetsQuery,
  type CoreArticleFacetsQueryVariables,
} from './article-facets.graphql.gen.ts';

/** The values of the list's filter fields with their counts. */
export type ArticleFacets = CoreArticleFacetsQuery['coreArticleFacets'];

// The values of each filter field of the articles list with how many listed articles have each,
// for the list's search, Show archived and filters (design ui-222, LI3). pnpm gen writes its typed
// document to article-facets.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreArticleFacets(
      $search: String
      $includeArchived: Boolean
      $articleGroupIds: [ID]
      $stockUnits: [StockUnit!]
      $sources: [String]
    ) {
      coreArticleFacets(
        search: $search
        includeArchived: $includeArchived
        articleGroupIds: $articleGroupIds
        stockUnits: $stockUnits
        sources: $sources
      ) {
        total
        articleGroups {
          id
          code
          name
          count
        }
        stockUnits {
          stockUnit
          count
        }
        sources {
          source
          count
        }
      }
    }
  `;
}
