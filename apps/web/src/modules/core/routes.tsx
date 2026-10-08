// SPDX-License-Identifier: AGPL-3.0-or-later
import { linkEntry } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import type { PlantRoute } from '@northmes/web-sdk';
import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { articleListSearch } from './article-list-search.ts';

/**
 * The core module's routes under the shell's $plant route. Each route takes its path from its
 * entry in coreLinks, so a path is written once, in the link manifest (ADR 0062); the list and the
 * article's page are the index routes of their entries. The list's search definition sits on its
 * route, never in the lazy screens.ts, from which the screens load.
 */
export function coreRoutes(plantRoute: PlantRoute) {
  const coreRoute = createRoute({
    getParentRoute: () => plantRoute,
    path: linkEntry(coreLinks).path,
  });
  const articlesRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.articles).path,
  });
  const articleListRoute = createRoute({
    getParentRoute: () => articlesRoute,
    path: '/',
    // Search, sort and page live in the URL; a key that does not apply falls back on its own.
    validateSearch: articleListSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'ArticlesScreen'),
  });
  const newArticleRoute = createRoute({
    getParentRoute: () => articlesRoute,
    path: linkEntry(coreLinks.articles.new).path,
    component: lazyRouteComponent(() => import('./screens.ts'), 'NewArticleScreen'),
  });
  const articleRoute = createRoute({
    getParentRoute: () => articlesRoute,
    path: linkEntry(coreLinks.articles.article).path,
  });
  const articleDetailRoute = createRoute({
    getParentRoute: () => articleRoute,
    path: '/',
    component: lazyRouteComponent(() => import('./screens.ts'), 'ArticleScreen'),
  });
  const editArticleRoute = createRoute({
    getParentRoute: () => articleRoute,
    path: linkEntry(coreLinks.articles.article.edit).path,
    component: lazyRouteComponent(() => import('./screens.ts'), 'EditArticleScreen'),
  });
  return coreRoute.addChildren([
    articlesRoute.addChildren([
      articleListRoute,
      newArticleRoute,
      articleRoute.addChildren([articleDetailRoute, editArticleRoute]),
    ]),
  ]);
}
