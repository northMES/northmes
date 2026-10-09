// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors, type ErrorLike } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Archive, Plus } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { formatDateTime } from '../../../../ui/lib/date-time.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import {
  type ArticleListSearch,
  articleListSearch,
  articleListVariables,
  articlePageSize,
  firstPageOf,
  nextPage,
  previousPage,
  searchedFor,
  showingArchived,
  sortedBy,
  sortOf,
} from '../../article-list-search.ts';
import { plantsLabel } from '../../article-plants.ts';
import { readForbiddenState } from '../../no-access.tsx';
import { usePlaces } from '../../use-places.ts';
import { CoreArticles, type CoreArticlesQuery } from './articles.graphql.ts';

/** One page of the list, as CoreArticles answers it. */
type ArticlesPage = CoreArticlesQuery['coreArticles'];

/** One row of the list. */
type ArticleRow = ArticlesPage['edges'][number]['node'];

/** The id of the Search articles input, where Clear filters moves focus. */
const searchFieldId = 'articles-search';

/** The id of the Show archived checkbox, which its label names. */
const showArchivedId = 'articles-show-archived';

/** The article number, the link to the article's page (IdentifierLink in the design). */
function ArticleLink({ article }: { readonly article: ArticleRow }) {
  const { plant } = useShell();
  return (
    <Link
      to={coreLinks.articles.article({ plant, articleId: article.id }).href}
      className="font-mono text-link underline underline-offset-2 hover:no-underline"
    >
      {article.code}
    </Link>
  );
}

const columns: readonly DataTableColumn<ArticleRow>[] = [
  {
    id: 'code',
    header: 'Article number',
    sortable: true,
    cell: (article) => <ArticleLink article={article} />,
  },
  {
    id: 'name',
    header: 'Name',
    sortable: true,
    // An archived article, listed with Show archived, carries the Archived badge (LI31).
    cell: (article) =>
      article.archivedAt === null ? (
        article.name
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          {article.name}
          <StatusBadge tone="neutral" icon={Archive}>
            Archived
          </StatusBadge>
        </span>
      ),
  },
  {
    // Where the article is used (ADR 0073); no design frame draws this column yet.
    id: 'plants',
    header: 'Plants',
    cell: (article) => plantsLabel(article),
  },
  {
    id: 'changed',
    header: 'Last changed',
    sortable: true,
    cell: (article) => (
      <time dateTime={article.updatedAt} className="font-mono">
        {formatDateTime(article.updatedAt)}
      </time>
    ),
  },
];

/** New article, the page's main action, as a link to the new article page. */
function NewArticleLink() {
  const { plant } = useShell();
  return (
    <Link to={coreLinks.articles.new({ plant }).href} className={buttonVariants()}>
      <Plus aria-hidden />
      New article
    </Link>
  );
}

/** Whether the API refused the cursor of the URL's page, because the rows changed (ST21). */
function isStaleCursor(error: ErrorLike | undefined): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some(({ extensions }) => extensions?.errorCode === 'core.list.invalid_cursor')
  );
}

interface StateOptions {
  /** The API refused the list, because the user holds no role that reads articles there. */
  readonly forbidden: boolean;
  /** The company's name, where the forbidden state says the permission is missing. */
  readonly companyName: string;
  readonly view: ArticleListSearch;
  readonly page: ArticlesPage | undefined;
  readonly error: ErrorLike | undefined;
  readonly retry: () => Promise<unknown>;
  readonly show: (view: ArticleListSearch) => void;
}

/**
 * The state of the list's data region (design ui-222, row 2): loading while a page has no rows
 * yet (ST2), the first-run empty state (ST3), the filtered empty state (ST17), the forbidden state
 * (ST19), a page whose cursor no longer applies (ST21) or a failed load (ST4).
 */
function listState({
  forbidden,
  companyName,
  view,
  page,
  error,
  retry,
  show,
}: StateOptions): PageState {
  if (forbidden) return readForbiddenState('articles', companyName);
  if (page === undefined && isStaleCursor(error)) {
    return {
      status: 'empty',
      title: 'This page of results is out of date',
      description:
        'The rows changed since this link was made, so this page can no longer be found.',
      action: <Button onClick={() => show(firstPageOf(view))}>Go to the first page</Button>,
    };
  }
  if (page === undefined && error !== undefined) {
    return {
      status: 'error',
      title: 'Could not load articles',
      error,
      onRetry: retry,
    };
  }
  if (page === undefined) return { status: 'loading' };
  if (page.totalCount > 0) return { status: 'ready' };
  if (view.q !== undefined) {
    return {
      status: 'empty',
      title: 'No articles match these filters',
      description: 'Change or clear the filters to see articles again.',
      action: (
        <Button
          variant="link"
          onClick={() => {
            show(searchedFor(view, ''));
            document.getElementById(searchFieldId)?.focus();
          }}
        >
          Clear filters
        </Button>
      ),
    };
  }
  return {
    status: 'empty',
    title: 'No articles yet',
    description:
      'Articles come from an import or are created here. Create the first one, or wait for the next import.',
    action: <NewArticleLink />,
  };
}

/**
 * The articles assigned to the plant or to All plants (design ui-222, LI1, and ADR 0073): Search
 * articles, Show archived, and one page of the DataTable with sortable Article number, Name and
 * Last changed headers, the Plants column, Previous, Next and the row range, newest change first
 * by default (A5). Archived articles show only with Show archived, each with the Archived badge
 * (LI31). A user who may not read articles gets the forbidden state with no toolbar and no page
 * actions (ST19, A18). Search, sort, Show archived and page live in the URL (plan 06, View state
 * in the URL), so a reload, Back or a copied link opens the same rows; each change replaces the
 * history entry and leaves focus where it is.
 */
export function ArticlesScreen() {
  const view = articleListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const { data, previousData, error, refetch } = useQuery(CoreArticles, {
    variables: articleListVariables(view),
    fetchPolicy: 'cache-and-network',
  });
  const page = data?.coreArticles;
  const forbidden = page === undefined && isForbidden(error);
  const places = usePlaces({ skip: !forbidden });
  // While a page loads, the pager keeps the buttons of the page before it, so the button just used
  // keeps focus.
  const shownPage = page ?? previousData?.coreArticles;
  const show = (next: ArticleListSearch) => {
    navigate({ to: '.', search: next, replace: true });
  };
  const state = listState({
    forbidden,
    companyName: places.company?.name ?? 'the company',
    view,
    page,
    error,
    retry: () => refetch(),
    show,
  });
  return (
    <PageFrame
      title="Articles"
      actions={forbidden ? undefined : <NewArticleLink />}
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <SearchField
              id={searchFieldId}
              label="Search articles"
              value={view.q ?? ''}
              onSearch={(text) => show(searchedFor(view, text))}
              className="w-full max-w-sm"
            />
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                id={showArchivedId}
                checked={view.archived !== undefined}
                onCheckedChange={(shown) => show(showingArchived(view, shown))}
              />
              <FieldLabel htmlFor={showArchivedId}>Show archived</FieldLabel>
            </Field>
          </div>
        )
      }
      state={state}
    >
      <DataTable
        label="Articles"
        columns={columns}
        rows={page?.edges.map(({ node }) => node) ?? []}
        getRowId={(article) => article.id}
        loading={page === undefined}
        sort={sortOf(view)}
        onSortChange={(sort) => show(sortedBy(view, sort))}
        paging={{
          page: view.page ?? 1,
          pageSize: articlePageSize,
          totalCount: page?.totalCount,
          hasPreviousPage: view.page !== undefined && (page?.pageInfo.hasPreviousPage ?? true),
          hasNextPage: shownPage?.pageInfo.hasNextPage ?? false,
          onPrevious: () => {
            const startCursor = page?.pageInfo.startCursor;
            if (startCursor) show(previousPage(view, startCursor));
          },
          onNext: () => {
            const endCursor = page?.pageInfo.endCursor;
            if (endCursor) show(nextPage(view, endCursor));
          },
        }}
      />
    </PageFrame>
  );
}
