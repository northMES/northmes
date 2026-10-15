// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { defineWebModule } from '@northmes/web-sdk';
import packageJson from '../package.json' with { type: 'json' };

/** The number of articles at the plant that are not archived, as the articles list counts them. */
const ArticleCount = gql`
  query ExampleArticleCount {
    coreArticleFacets {
      total
    }
  }
`;

interface ArticleCountQuery {
  readonly coreArticleFacets: { readonly total: number };
}

/**
 * The widget. It reads through the shell's Apollo client, which signs the request in and names the
 * plant, so the API answers with what the signed-in user may read there.
 */
function ArticleCountWidget({ plant }: { readonly plant: string }) {
  const { data, error, loading } = useQuery<ArticleCountQuery>(ArticleCount);
  if (loading) return <p className="text-muted-foreground">Counting articles…</p>;
  if (error !== undefined || data === undefined) {
    return <p className="text-muted-foreground">The articles could not be counted.</p>;
  }
  const { total } = data.coreArticleFacets;
  return (
    <p>
      <span className="block font-mono text-3xl font-semibold tabular-nums">{total}</span>
      <span className="text-muted-foreground">
        {total === 1 ? 'article' : 'articles'} at {plant}
      </span>
    </p>
  );
}

/** The plugin's web part: no pages, one widget for the dashboard. */
export default defineWebModule({
  id: 'example-article-count',
  version: packageJson.version,
  contributions: { 'example-article-count.count': ArticleCountWidget },
});
