// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import type { Article } from '../../article.graphql.ts';
import { useArticle } from '../../use-article.tsx';

/** The article's Identity section (design ui-222, DE1): a card with its number and name. */
function Identity({ article }: { readonly article: Article | undefined }) {
  const value = (text: string | undefined, className?: string) =>
    text === undefined ? (
      <span
        aria-hidden
        className="block h-3 w-32 animate-pulse rounded-sm bg-accent motion-reduce:animate-none"
      />
    ) : (
      <span className={className}>{text}</span>
    );
  return (
    <section
      aria-labelledby="article-identity"
      className="max-w-190 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <h2 id="article-identity" className="text-base font-semibold">
        Identity
      </h2>
      <dl className="mt-4 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">Article number</dt>
        <dd>{value(article?.code, 'font-mono')}</dd>
        <dt className="text-muted-foreground">Name</dt>
        <dd>{value(article?.name)}</dd>
      </dl>
    </section>
  );
}

/**
 * An article's page (design ui-222, DE1): its number in the h1 and the Identity section, with
 * Edit in the page actions. While it loads the h1 reads Article (A12); an article that does not
 * exist, or that the plant cannot see, shows the not-found state (ST7), and a failed load an error
 * with Try again (ST8).
 */
export function ArticleScreen() {
  const { plantId } = useShell();
  const { article, state } = useArticle();
  return (
    <PageFrame
      title={article === undefined ? 'Article' : `Article ${article.code}`}
      crumbs={[{ label: 'Articles', href: coreLinks.articles({ plant: plantId }).href }]}
      actions={
        article === undefined ? undefined : (
          <Link
            to={coreLinks.articles.article.edit({ plant: plantId, articleId: article.id }).href}
            className={buttonVariants()}
          >
            <Pencil aria-hidden />
            Edit
          </Link>
        )
      }
      state={state}
    >
      <Identity article={article} />
    </PageFrame>
  );
}
