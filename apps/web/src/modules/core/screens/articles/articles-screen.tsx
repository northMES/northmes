// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors, type ErrorLike } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import type { Article } from '../../article.graphql.ts';
import {
  type ArticleListSearch,
  articleListSearch,
  articleListVariables,
  articlePageSize,
  firstPageOf,
  nextPage,
  previousPage,
  searchedFor,
  sortedBy,
  sortOf,
} from '../../article-list-search.ts';
import { type ArticlesPage, CoreArticles } from './articles.graphql.ts';

/** The id of the Search articles input, where Clear filters moves focus. */
const searchFieldId = 'articles-search';

/** The article number, the link to the article's page (IdentifierLink in the design). */
function ArticleLink({ article }: { readonly article: Article }) {
  const { plantId } = useShell();
  return (
    <Link
      to={coreLinks.articles.article({ plant: plantId, articleId: article.id }).href}
      className="font-mono text-link underline underline-offset-2 hover:no-underline"
    >
      {article.code}
    </Link>
  );
}

const columns: readonly DataTableColumn<Article>[] = [
  {
    id: 'code',
    header: 'Article number',
    sortable: true,
    cell: (article) => <ArticleLink article={article} />,
  },
  { id: 'name', header: 'Name', sortable: true, cell: (article) => article.name },
];

/** New article, the page's main action, as a link to the new article page. */
function NewArticleLink() {
  const { plantId } = useShell();
  return (
    <Link to={coreLinks.articles.new({ plant: plantId }).href} className={buttonVariants()}>
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
  readonly view: ArticleListSearch;
  readonly page: ArticlesPage | undefined;
  readonly error: ErrorLike | undefined;
  readonly retry: () => void;
  readonly show: (view: ArticleListSearch) => void;
}

/**
 * The state of the list's data region (design ui-222, row 2): loading while a page has no rows
 * yet (ST2), the first-run empty state (ST3), the filtered empty state (ST17), a page whose cursor
 * no longer applies (ST21) or a failed load (ST4).
 */
function listState({ view, page, error, retry, show }: StateOptions): PageState {
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
      description: 'Check the connection, then try again.',
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
 * The articles of the plant (design ui-222, LI1): Search articles, and one page of the DataTable
 * with sortable Article number and Name headers, Previous, Next and the row range. Search, sort
 * and page live in the URL (plan 06, View state in the URL), so a reload, Back or a copied link
 * opens the same rows; each change replaces the history entry and leaves focus where it is.
 */
export function ArticlesScreen() {
  const view = articleListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const { data, previousData, error, refetch } = useQuery(CoreArticles, {
    variables: articleListVariables(view),
    fetchPolicy: 'cache-and-network',
  });
  const page = data?.coreArticles;
  // While a page loads, the pager keeps the buttons of the page before it, so the button just used
  // keeps focus.
  const shownPage = page ?? previousData?.coreArticles;
  const show = (next: ArticleListSearch) => {
    navigate({ to: '.', search: next, replace: true });
  };
  const state = listState({
    view,
    page,
    error,
    retry: () => {
      refetch().catch(() => {});
    },
    show,
  });
  return (
    <PageFrame
      title="Articles"
      actions={<NewArticleLink />}
      toolbar={
        <SearchField
          id={searchFieldId}
          label="Search articles"
          value={view.q ?? ''}
          onSearch={(text) => show(searchedFor(view, text))}
          className="max-w-sm"
        />
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
