// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUpdateArticleDocument as CoreUpdateArticle,
  type CoreUpdateArticleMutation,
  type CoreUpdateArticleMutationVariables,
} from './update-article.graphql.gen.ts';

// Changes an article through the command core.updateArticle. The normalized cache merges the
// answer into the article that the list and the article's page hold. pnpm gen writes its typed
// document to update-article.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreUpdateArticle($input: CoreUpdateArticleInput!) {
      coreUpdateArticle(input: $input) {
        id
        code
        name
        version
      }
    }
  `;
}
