// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineOperations } from '@northmes/contracts';
import {
  archiveArticleGroup,
  createArticleGroup,
  restoreArticleGroup,
  updateArticleGroup,
} from '../article-group.ts';
import { articleGroup, findArticleGroups, getArticleGroup } from '../article-group-queries.ts';

/**
 * Core's article group operations (ADR 0073): the public REST family at /api/v1/core/, bound to
 * ArticleGroupService. A group belongs to the company, so a request takes an optional plant and
 * acts at the company without one. No agent tool reaches them.
 */
export const articleGroupOperations = defineOperations({
  module: 'core',
  resource: 'article-groups',
  scope: 'companyOrPlant',
  operations: {
    find: {
      contract: findArticleGroups,
      rest: { method: 'GET', path: 'article-groups', status: 200, maxPageSize: 100 },
      tool: false,
    },
    get: {
      contract: getArticleGroup,
      rest: { method: 'GET', path: 'article-groups/{id}', status: 200 },
      tool: false,
    },
    create: {
      contract: createArticleGroup,
      output: articleGroup,
      rest: { method: 'POST', path: 'commands/create-article-group', status: 201 },
      tool: false,
    },
    update: {
      contract: updateArticleGroup,
      output: articleGroup,
      rest: { method: 'POST', path: 'commands/update-article-group', status: 200 },
      tool: false,
    },
    archive: {
      contract: archiveArticleGroup,
      output: articleGroup,
      rest: { method: 'POST', path: 'commands/archive-article-group', status: 200 },
      tool: false,
    },
    restore: {
      contract: restoreArticleGroup,
      output: articleGroup,
      rest: { method: 'POST', path: 'commands/restore-article-group', status: 200 },
      tool: false,
    },
  },
});
