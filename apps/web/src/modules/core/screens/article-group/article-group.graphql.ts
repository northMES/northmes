// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';
import type { CoreArticleGroupQuery } from './article-group.graphql.gen.ts';

export {
  CoreArticleGroupDocument as CoreArticleGroup,
  type CoreArticleGroupQuery,
  type CoreArticleGroupQueryVariables,
} from './article-group.graphql.gen.ts';

/** An article group with the fields its page shows and the version a change sends. */
export type ArticleGroup = NonNullable<CoreArticleGroupQuery['coreArticleGroup']>;

// The article group with this id among the company's, or null. pnpm gen writes its typed document
// to article-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreArticleGroup($id: ID!) {
      coreArticleGroup(id: $id) {
        id
        code
        name
        version
        archivedAt
        updatedAt
      }
    }
  `;
}
