// SPDX-License-Identifier: MIT
import { defineOperations } from '@northmes/contracts';
import {
  archiveArticle,
  createArticle,
  restoreArticle,
  setArticlePlants,
  updateArticle,
  upsertArticle,
} from '../article.ts';
import { article, findArticles, getArticle } from '../article-queries.ts';

/**
 * Core's article operations (ADR 0073): the public REST family at /api/v1/core/, the tool
 * core_get_article, which WebMCP registers, and the backend binds each to one method of
 * ArticleService. Articles live at the company, so a request takes an optional plant and acts at
 * the company without one. Agents find articles through core_search rather than a list tool.
 */
export const articleOperations = defineOperations({
  module: 'core',
  resource: 'articles',
  scope: 'companyOrPlant',
  operations: {
    find: {
      contract: findArticles,
      rest: { method: 'GET', path: 'articles', status: 200, maxPageSize: 100 },
      tool: false,
    },
    get: {
      contract: getArticle,
      rest: { method: 'GET', path: 'articles/{id}', status: 200 },
      tool: {
        name: 'core_get_article',
        title: 'Get an article',
        description: 'One article by id, with its plants, version and last change.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        effect: 'read',
      },
      webmcp: true,
    },
    create: {
      contract: createArticle,
      output: article,
      rest: { method: 'POST', path: 'commands/create-article', status: 201 },
      tool: false,
    },
    update: {
      contract: updateArticle,
      output: article,
      rest: { method: 'POST', path: 'commands/update-article', status: 200 },
      tool: false,
    },
    setPlants: {
      contract: setArticlePlants,
      output: article,
      rest: { method: 'POST', path: 'commands/set-article-plants', status: 200 },
      tool: false,
    },
    archive: {
      contract: archiveArticle,
      output: article,
      rest: { method: 'POST', path: 'commands/archive-article', status: 200 },
      tool: false,
    },
    restore: {
      contract: restoreArticle,
      output: article,
      rest: { method: 'POST', path: 'commands/restore-article', status: 200 },
      tool: false,
    },
    upsert: {
      contract: upsertArticle,
      output: article,
      rest: { method: 'POST', path: 'commands/upsert-article', status: 201 },
      tool: false,
    },
  },
});
