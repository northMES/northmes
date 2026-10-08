// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { buttonVariants } from '../../ui/button-variants.ts';
import { DataTable, type DataTableColumn } from '../../ui/data-table.tsx';
import { PageFrame, type PageState } from '../../ui/page-frame.tsx';
import { type Article, CoreArticles } from './articles.graphql.ts';

/** The page size of the list (design ui-222, open question 15). */
const pageSize = 25;

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

/**
 * The articles of the plant (design ui-222, LI1): one page of the DataTable, sorted by article
 * number, with Previous, Next and the row range, and New article in the page actions. While a
 * page loads, the table draws skeleton rows (ST2); a plant without articles shows No articles yet
 * (ST3), and a failed load an error with Try again (ST4).
 */
export function ArticlesScreen() {
  const { data, error, refetch } = useQuery(CoreArticles, {
    variables: { first: pageSize, orderBy: [{ field: 'CODE', direction: 'ASC' }] },
    fetchPolicy: 'cache-and-network',
  });
  const page = data?.coreArticles;
  let state: PageState = { status: 'ready' };
  if (page === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load articles',
      description: 'Check the connection, then try again.',
      onRetry: () => {
        refetch().catch(() => {});
      },
    };
  } else if (page === undefined) {
    state = { status: 'loading' };
  } else if (page.totalCount === 0) {
    state = {
      status: 'empty',
      title: 'No articles yet',
      description:
        'Articles come from an import or are created here. Create the first one, or wait for the next import.',
      action: <NewArticleLink />,
    };
  }
  return (
    <PageFrame title="Articles" actions={<NewArticleLink />} state={state}>
      <DataTable
        label="Articles"
        columns={columns}
        rows={page?.edges.map(({ node }) => node) ?? []}
        getRowId={(article) => article.id}
        loading={page === undefined}
        sort={{ id: 'code', desc: false }}
        paging={{
          page: 1,
          pageSize,
          totalCount: page?.totalCount,
          hasPreviousPage: page?.pageInfo.hasPreviousPage ?? false,
          hasNextPage: page?.pageInfo.hasNextPage ?? false,
          onPrevious: () => {},
          onNext: () => {},
        }}
      />
    </PageFrame>
  );
}
