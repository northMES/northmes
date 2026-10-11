// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUpdateArticleGroupDocument as CoreUpdateArticleGroup,
  type CoreUpdateArticleGroupMutation,
  type CoreUpdateArticleGroupMutationVariables,
} from './update-article-group.graphql.gen.ts';

// core.updateArticleGroup on the group's page. pnpm gen writes its typed document to
// update-article-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreUpdateArticleGroup($input: CoreUpdateArticleGroupInput!) {
      coreUpdateArticleGroup(input: $input) {
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
