// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreArchiveArticleGroupDocument as CoreArchiveArticleGroup,
  type CoreArchiveArticleGroupMutation,
  type CoreArchiveArticleGroupMutationVariables,
} from './archive-article-group.graphql.gen.ts';

// core.archiveArticleGroup on the group's page. pnpm gen writes its typed document to
// archive-article-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreArchiveArticleGroup($input: CoreArchiveArticleGroupInput!) {
      coreArchiveArticleGroup(input: $input) {
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
