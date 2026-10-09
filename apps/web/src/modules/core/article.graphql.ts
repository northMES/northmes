// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import type { CoreArticleQuery } from './article.graphql.gen.ts';

export {
  CoreArticleDocument as CoreArticle,
  type CoreArticleQuery,
  type CoreArticleQueryVariables,
} from './article.graphql.gen.ts';

/** An article with the fields the articles pages show and the version an edit sends. */
export type Article = NonNullable<CoreArticleQuery['coreArticle']>;

// The article with this id at the plant, or null. The article's page, the edit page and the new
// article page's cache update all read it. pnpm gen writes its typed document to
// article.graphql.gen.ts; this block never runs, so the bundle holds only the generated document.
if (false) {
  gql`
    query CoreArticle($id: ID!) {
      coreArticle(id: $id) {
        id
        code
        name
        version
      }
    }
  `;
}
