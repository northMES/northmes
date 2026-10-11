// SPDX-License-Identifier: AGPL-3.0-or-later
import { articleList as articleListDeclaration } from '@northmes/core-contracts';
import { defineList } from '@northmes/sdk/lists';
import { Article } from '../types/article.type.ts';

/**
 * The list of articles that core's contracts package declares (ADR 0073): coreArticles, by code
 * unless orderBy says otherwise, such as UPDATED_AT descending for the most recent change first,
 * without the archived ones unless includeArchived asks for them (ADR 0016). core.findArticles
 * reads the same declaration.
 */
export const articleList = defineList(articleListDeclaration, { node: () => Article });

/** The arguments of coreArticles. */
export type ArticleListArgs = Parameters<typeof articleList.page>[2];
