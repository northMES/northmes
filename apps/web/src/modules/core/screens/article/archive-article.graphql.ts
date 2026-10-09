// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreArchiveArticleDocument as CoreArchiveArticle,
  type CoreArchiveArticleMutation,
  type CoreArchiveArticleMutationVariables,
} from './archive-article.graphql.gen.ts';

// Archives an article through the command core.archiveArticle. The normalized cache merges the
// answer into the article that the list and the article's page hold. pnpm gen writes its typed
// document to archive-article.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreArchiveArticle($input: CoreArchiveArticleInput!) {
      coreArchiveArticle(input: $input) {
        id
        code
        name
        version
        archivedAt
      }
    }
  `;
}
