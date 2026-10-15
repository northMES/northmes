// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { articleGroupList as articleGroupListDeclaration } from '@northmes/core-contracts';
import { defineList } from '@northmes/sdk/lists';
import { ArticleGroup } from '../types/article-group.type.ts';

/**
 * The list of the company's article groups that core's contracts package declares:
 * coreArticleGroups, by code unless orderBy says otherwise, without the archived ones unless
 * includeArchived asks for them (ADR 0016). core.findArticleGroups reads the same declaration.
 */
export const articleGroupList = defineList(articleGroupListDeclaration, {
  node: () => ArticleGroup,
});

/** The arguments of coreArticleGroups. */
export type ArticleGroupListArgs = Parameters<typeof articleGroupList.page>[2];
