// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useApolloClient } from '@apollo/client/react';
import { type ReactNode, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from '../../../../ui/components/data-table/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
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
  /** The table's menus at the end of its header row, Group by and Columns (#875). */
  readonly headerMenu?: ReactNode;
}

/**
 * The articles grouped by a filter field (design ui-222, LI29): a header row per value with how
 * many articles have it, each a button that opens the group and loads its first 100 articles in
 * the list's order, and the number of groups and articles under the table. The view's search and
 * filters apply in every group. A new view starts with every group closed. An opened group says
 * it is loading until its rows arrive; when they do not, it says so in the group and the polite
 * region, and closing and opening it tries again.
 */
export function ArticlesGrouped({
  view,
  facets,
  columns,
  hiddenColumns,
  sort,
  onSortChange,
  headerMenu,
}: ArticlesGroupedProps) {
  const client = useApolloClient();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [rows, setRows] = useState<ReadonlyMap<string, readonly ArticleRow[]>>(new Map());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const values = valuesOf(view.group ?? 'articleGroup', facets);

  const toggle = (value: string, label: string, expanded: boolean) => {
    setOpen((before) => {
      const next = new Set(before);
      if (expanded) next.add(value);
      else next.delete(value);
      return next;
    });
    if (!expanded || rows.has(value)) return;
    setFailed((before) => without(before, value));
    client
      .query({ query: CoreArticles, variables: groupRowsVariables(view, value) })
      .then(({ data }) => {
        const loaded = data?.coreArticles.edges.map(({ node }) => node) ?? [];
        setRows((before) => new Map(before).set(value, loaded));
      })
      .catch(() => {
        // The group stays open without rows and says why; closing and opening it tries again.
        setFailed((before) => new Set(before).add(value));
        announce(`Could not load the articles of ${label}`);
      });
  };

  /** What an opened group without rows shows: that they load, or that they did not. */
  const emptyOf = (value: string, label: string) =>
    failed.has(value)
      ? `Could not load the articles of ${label}. Close the group and open it again to try again.`
      : rows.has(value)
        ? undefined
        : `Loading the articles of ${label}`;

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
      headerMenu={headerMenu}
      groups={values.map(({ value, label, count }) => ({
        id: value,
        label,
        count: articles(count),
        rows: rows.get(value) ?? [],
        empty: emptyOf(value, label),
        expanded: open.has(value),
        onExpandedChange: (expanded) => toggle(value, label, expanded),
      }))}
      footer={
        facets === undefined
          ? undefined
          : `${values.length} ${values.length === 1 ? 'group' : 'groups'}, ${articles(facets.total)}`
      }
    />
  );
}

/** The set without value. */
function without(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(value);
  return next;
}
