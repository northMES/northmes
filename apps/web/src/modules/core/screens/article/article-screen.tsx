// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { unitOf } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { cn } from 'cn';
import { Archive } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { formatDateTime } from '../../../../ui/lib/date-time.ts';
import { languageName } from '../../../../ui/lib/languages.ts';
import type { Article } from '../../article.graphql.ts';
import { plantsLabel } from '../../article-plants.ts';
import { useArticle } from '../../use-article.tsx';
import { ArticleActions } from './article-actions.tsx';

/** A value of a definition list, or its skeleton while the article loads. */
function Value({
  text,
  className,
}: {
  readonly text: string | undefined;
  readonly className?: string;
}) {
  if (text === undefined) {
    return (
      <span
        aria-hidden
        className="block h-3 w-32 animate-pulse rounded-sm bg-accent motion-reduce:animate-none"
      />
    );
  }
  return <span className={className}>{text}</span>;
}

/**
 * The article's name, and under it each translation of the name with its language, the
 * translation carrying its own lang (design ui-222, DE1).
 */
function ArticleName({ article }: { readonly article: Article | undefined }) {
  if (article === undefined) return <Value text={undefined} />;
  return (
    <>
      <span className="block">{article.name}</span>
      {article.translations.map(({ locale, text }) => (
        <span key={locale} className="block text-xs text-muted-foreground">
          {languageName(locale)}: <span lang={locale}>{text}</span>
        </span>
      ))}
    </>
  );
}

/** A section of the article's page: a card named by its h2 (design ui-222, DE1). */
function Section({
  id,
  title,
  className,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('rounded-xl border border-border bg-card p-6 text-card-foreground', className)}
    >
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A section's terms and their values, each a pair of a term and a value. */
function Definitions({
  rows,
}: {
  readonly rows: readonly (readonly [term: string, value: ReactNode])[];
}) {
  return (
    <dl className="mt-4 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-3 text-sm">
      {rows.map(([term, value]) => (
        <Fragment key={term}>
          <dt className="text-muted-foreground">{term}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * The article's sections (design ui-222, DE1): Identity with its number and name, Classification
 * with its article group and stock unit, its Note, and Origin with its plants (ADR 0073), where it
 * came from, and when it was created and last changed. The "By" lines of Created and Last changed
 * come with the audit trail (#443).
 */
function ArticleSections({ article }: { readonly article: Article | undefined }) {
  const loaded = <T,>(read: (loaded: Article) => T) =>
    article === undefined ? undefined : read(article);
  return (
    <div className="grid max-w-285 gap-4 lg:grid-cols-2">
      <Section id="article-identity" title="Identity">
        <Definitions
          rows={[
            ['Article number', <Value key="code" text={article?.code} className="font-mono" />],
            ['Name', <ArticleName key="name" article={article} />],
          ]}
        />
      </Section>
      <Section id="article-classification" title="Classification">
        <Definitions
          rows={[
            [
              'Article group',
              <Value
                key="group"
                text={loaded(({ articleGroup }) => articleGroup?.name ?? 'No article group')}
              />,
            ],
            [
              'Stock unit',
              <Value key="unit" text={loaded(({ stockUnit }) => unitOf(stockUnit).label)} />,
            ],
          ]}
        />
      </Section>
      <Section id="article-note" title="Note" className="lg:col-span-2">
        {article === undefined ? (
          <p className="mt-4">
            <Value text={undefined} />
          </p>
        ) : (
          <p className="mt-4 text-sm whitespace-pre-line">
            {article.note ?? <span className="text-muted-foreground">No note.</span>}
          </p>
        )}
      </Section>
      <Section id="article-origin" title="Origin" className="lg:col-span-2">
        <Definitions
          rows={[
            ['Plants', <Value key="plants" text={loaded(plantsLabel)} />],
            ['Source', <Value key="source" text={loaded(({ source }) => source ?? 'NorthMES')} />],
            [
              'Created',
              <Value
                key="created"
                text={loaded(({ createdAt }) => formatDateTime(createdAt))}
                className="font-mono"
              />,
            ],
            [
              'Last changed',
              <Value
                key="changed"
                text={loaded(({ updatedAt }) => formatDateTime(updatedAt))}
                className="font-mono"
              />,
            ],
          ]}
        />
      </Section>
    </div>
  );
}

/**
 * An article's page (design ui-222, DE1): its number in the h1 with its name beside it, and its
 * sections, with Archive and Edit in the page actions; an archived article carries the Archived
 * badge and offers Restore. Its plants show in Origin, and Edit changes them (ADR 0073). While
 * it loads the h1 reads Article (A12); an
 * article that does not exist, or that the plant cannot see, shows the not-found state (ST7), and
 * a failed load an error with Try again (ST8).
 */
export function ArticleScreen() {
  const { plant } = useShell();
  const { article, state, reload } = useArticle();
  return (
    <PageFrame
      title={article === undefined ? 'Article' : `Article ${article.code}`}
      crumbs={[{ label: 'Articles', href: coreLinks.articles({ plant }).href }]}
      actions={
        article === undefined ? undefined : <ArticleActions article={article} reload={reload} />
      }
      meta={
        article === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">{article.name}</span>
        )
      }
      state={state}
    >
      {article?.archivedAt != null && (
        <p>
          <StatusBadge tone="neutral" icon={Archive}>
            Archived
          </StatusBadge>
        </p>
      )}
      <ArticleSections article={article} />
    </PageFrame>
  );
}
