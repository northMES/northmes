// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreRestoreArticleGroupDocument as CoreRestoreArticleGroup,
  type CoreRestoreArticleGroupMutation,
  type CoreRestoreArticleGroupMutationVariables,
} from './restore-article-group.graphql.gen.ts';

// core.restoreArticleGroup on the group's page. pnpm gen writes its typed document to
// restore-article-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreRestoreArticleGroup($input: CoreRestoreArticleGroupInput!) {
      coreRestoreArticleGroup(input: $input) {
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
