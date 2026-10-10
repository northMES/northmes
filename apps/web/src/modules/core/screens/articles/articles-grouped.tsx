// SPDX-License-Identifier: AGPL-3.0-or-later
import { useApolloClient } from '@apollo/client/react';
import { useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from '../../../../ui/components/data-table/index.ts';
import { type ArticleListSearch, groupRowsVariables } from '../../article-list-search.ts';
import type { ArticleFacets } from './article-facets.graphql.ts';
import { CoreArticles, type CoreArticlesQuery } from './articles.graphql.ts';
import { valuesOf } from './articles-values.ts';

/** One row of the list. */
type ArticleRow = CoreArticlesQuery['coreArticles']['edges'][number]['node'];

/** "1 article" or "12 articles". */
function articles(count: number): string {
  return `${count} ${count === 1 ? 'article' : 'articles'}`;
}

interface ArticlesGroupedProps {
  readonly view: ArticleListSearch;
  readonly facets: ArticleFacets | undefined;
  readonly columns: readonly DataTableColumn<ArticleRow>[];
  readonly hiddenColumns: readonly string[];
  readonly sort: DataTableSort;
  readonly onSortChange: (sort: DataTableSort) => void;
}

/**
 * The articles grouped by a filter field (design ui-222, LI29): a header row per value with how
 * many articles have it, each a button that opens the group and loads its first 100 articles in
 * the list's order, and the number of groups and articles under the table. The view's search and
 * filters apply in every group. A new view starts with every group closed.
 */
export function ArticlesGrouped({
  view,
  facets,
  columns,
  hiddenColumns,
  sort,
  onSortChange,
}: ArticlesGroupedProps) {
  const client = useApolloClient();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [rows, setRows] = useState<ReadonlyMap<string, readonly ArticleRow[]>>(new Map());
  const values = valuesOf(view.group ?? 'articleGroup', facets);

  const toggle = (value: string, expanded: boolean) => {
    setOpen((before) => {
      const next = new Set(before);
      if (expanded) next.add(value);
      else next.delete(value);
      return next;
    });
    if (!expanded || rows.has(value)) return;
    client
      .query({ query: CoreArticles, variables: groupRowsVariables(view, value) })
      .then(({ data }) => {
        const loaded = data?.coreArticles.edges.map(({ node }) => node) ?? [];
        setRows((before) => new Map(before).set(value, loaded));
      })
      .catch(() => {
        // The group stays open without rows; closing and opening it tries again.
        setRows((before) => {
          const next = new Map(before);
          next.delete(value);
          return next;
        });
      });
  };

  return (
    <DataTable
      label="Articles"
      columns={columns}
      rows={[]}
      getRowId={(article) => `${article.id}`}
      loading={facets === undefined}
      sort={sort}
      onSortChange={onSortChange}
      hiddenColumns={hiddenColumns}
      groups={values.map(({ value, label, count }) => ({
        id: value,
        label,
        count: articles(count),
        rows: rows.get(value) ?? [],
        expanded: open.has(value),
        onExpandedChange: (expanded) => toggle(value, expanded),
      }))}
      footer={
        facets === undefined
          ? undefined
          : `${values.length} ${values.length === 1 ? 'group' : 'groups'}, ${articles(facets.total)}`
      }
    />
  );
}
