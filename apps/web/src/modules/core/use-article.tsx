// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams } from '@tanstack/react-router';
import type { PageState } from '../../ui/components/page-frame/index.ts';
import { buttonVariants } from '../../ui/primitives/button.tsx';
import { type Article, CoreArticle } from './article.graphql.ts';

/** What the article and edit pages read of the article in the URL. */
export interface ArticleOfPage {
  /** The article once it loaded, or undefined while it loads, is missing or failed. */
  readonly article: Article | undefined;
  /**
   * The page state: loading (ST6), not found for an article that does not exist or that the plant
   * cannot see (ST7), or an error with Try again (ST8).
   */
  readonly state: PageState;
  /** Reads the article from the API again and returns its saved values. */
  readonly reload: () => Promise<Article | undefined>;
}

/** Reads the article that the $articleId segment of the URL names. */
export function useArticle(): ArticleOfPage {
  const { plant } = useShell();
  const { articleId } = useParams({ strict: false });
  const { data, error, refetch } = useQuery(CoreArticle, { variables: { id: articleId ?? '' } });
  const article = data?.coreArticle ?? undefined;
  const reload = async () => (await refetch()).data?.coreArticle ?? undefined;
  let state: PageState = { status: 'ready' };
  if (data === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the article',
      description: 'Check the connection, then try again.',
      onRetry: () => {
        reload().catch(() => {});
      },
    };
  } else if (data === undefined) {
    state = { status: 'loading' };
  } else if (article === undefined) {
    state = {
      status: 'empty',
      title: 'This article does not exist or you cannot see it',
      description:
        'The link may be out of date, or the article belongs to a plant you have no role in.',
      action: (
        <Link
          to={coreLinks.articles({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Articles
        </Link>
      ),
    };
  }
  return { article, state, reload };
}
