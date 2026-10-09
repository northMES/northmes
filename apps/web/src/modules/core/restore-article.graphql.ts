// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreRestoreArticleDocument as CoreRestoreArticle,
  type CoreRestoreArticleMutation,
  type CoreRestoreArticleMutationVariables,
} from './restore-article.graphql.gen.ts';

// Restores an archived article through the command core.restoreArticle. The article's page and the
// edit page both run it. The normalized cache merges the answer into the article that the list and
// the article's page hold. pnpm gen writes its typed document to restore-article.graphql.gen.ts;
// this block never runs.
if (false) {
  gql`
    mutation CoreRestoreArticle($input: CoreRestoreArticleInput!) {
      coreRestoreArticle(input: $input) {
        id
        code
        name
        version
        archivedAt
      }
    }
  `;
}
