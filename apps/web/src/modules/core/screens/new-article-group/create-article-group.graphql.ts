// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreCreateArticleGroupDocument as CoreCreateArticleGroup,
  type CoreCreateArticleGroupMutation,
  type CoreCreateArticleGroupMutationVariables,
} from './create-article-group.graphql.gen.ts';

// core.createArticleGroup on the new article group page. pnpm gen writes its typed document to
// create-article-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreCreateArticleGroup($input: CoreCreateArticleGroupInput!) {
      coreCreateArticleGroup(input: $input) {
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
