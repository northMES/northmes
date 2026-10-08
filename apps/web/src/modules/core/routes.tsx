// SPDX-License-Identifier: AGPL-3.0-or-later
import { linkEntry } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import type { PlantRoute } from '@northmes/web-sdk';
import { createRoute, lazyRouteComponent } from '@tanstack/react-router';

/**
 * The core module's routes under the shell's $plant route. Each route takes its path from its
 * entry in coreLinks, so a path is written once, in the link manifest (ADR 0062); the list and the
 * article's page are the index routes of their entries. The screens load lazily from screens.ts.
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
    component: lazyRouteComponent(() => import('./screens.ts'), 'ArticlesScreen'),
  });
  const newArticleRoute = createRoute({
    getParentRoute: () => articlesRoute,
    path: linkEntry(coreLinks.articles.new).path,
  });
  const articleRoute = createRoute({
    getParentRoute: () => articlesRoute,
    path: linkEntry(coreLinks.articles.article).path,
  });
  const articleDetailRoute = createRoute({
    getParentRoute: () => articleRoute,
    path: '/',
  });
  const editArticleRoute = createRoute({
    getParentRoute: () => articleRoute,
    path: linkEntry(coreLinks.articles.article.edit).path,
  });
  return coreRoute.addChildren([
    articlesRoute.addChildren([
      articleListRoute,
      newArticleRoute,
      articleRoute.addChildren([articleDetailRoute, editArticleRoute]),
    ]),
  ]);
}
