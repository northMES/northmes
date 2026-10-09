// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineList } from '@northmes/sdk/lists';
import { Article } from '../types/article.type.ts';

/**
 * The list of a plant's articles: coreArticles, by code unless orderBy says otherwise, without the
 * archived ones unless includeArchived asks for them (ADR 0016).
 */
export const articleList = defineList({
  name: 'Article',
  node: () => Article,
  sortFields: {
    CODE: { column: 'code', type: 'text' },
    NAME: { column: 'name', type: 'text' },
  },
  defaultOrderBy: [{ field: 'CODE' }],
  search: ['code', 'name'],
  archivable: true,
});

/** The arguments of coreArticles. */
export type ArticleListArgs = Parameters<typeof articleList.page>[2];
