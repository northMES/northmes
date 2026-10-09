// SPDX-License-Identifier: AGPL-3.0-or-later
import { linkEntry } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import type { PlantRoute } from '@northmes/web-sdk';
import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { newRoleSearch, rolePageSearch, userPageSearch } from './access-search.ts';
import { articleListSearch } from './article-list-search.ts';
import { userListSearch } from './user-list-search.ts';

/**
 * The core module's routes under the shell's $plant route. Each route takes its path from its
 * entry in coreLinks, so a path is written once, in the link manifest (ADR 0062); a list and a
 * record's page are the index routes of their entries. Each search definition sits on its route,
 * never in the lazy screens.ts, from which the screens load.
 */
/** A screen of screens.ts as a route component, which loads the screens' chunk on first use. */
function lazyScreen(name: keyof typeof import('./screens.ts')) {
  return lazyRouteComponent(() => import('./screens.ts'), name);
}

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
    component: lazyScreen('ArticlesScreen'),
  });
  const newArticleRoute = createRoute({
    getParentRoute: () => articlesRoute,
    path: linkEntry(coreLinks.articles.new).path,
    component: lazyScreen('NewArticleScreen'),
  });
  const articleRoute = createRoute({
    getParentRoute: () => articlesRoute,
    path: linkEntry(coreLinks.articles.article).path,
  });
  const articleDetailRoute = createRoute({
    getParentRoute: () => articleRoute,
    path: '/',
    component: lazyScreen('ArticleScreen'),
  });
  const editArticleRoute = createRoute({
    getParentRoute: () => articleRoute,
    path: linkEntry(coreLinks.articles.article.edit).path,
    component: lazyScreen('EditArticleScreen'),
  });
  const usersRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.users).path,
  });
  const userListRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: '/',
    validateSearch: userListSearch,
    component: lazyScreen('UsersScreen'),
  });
  const newUserRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: linkEntry(coreLinks.users.new).path,
    component: lazyScreen('NewUserScreen'),
  });
  const userRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: linkEntry(coreLinks.users.user).path,
  });
  const userDetailRoute = createRoute({
    getParentRoute: () => userRoute,
    path: '/',
    validateSearch: userPageSearch,
    component: lazyScreen('UserScreen'),
  });
  const addRoleRoute = createRoute({
    getParentRoute: () => userRoute,
    path: linkEntry(coreLinks.users.user.addRole).path,
    component: lazyScreen('AddRoleScreen'),
  });
  const rolesRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.roles).path,
  });
  const roleListRoute = createRoute({
    getParentRoute: () => rolesRoute,
    path: '/',
    component: lazyScreen('RolesScreen'),
  });
  const newRoleRoute = createRoute({
    getParentRoute: () => rolesRoute,
    path: linkEntry(coreLinks.roles.new).path,
    validateSearch: newRoleSearch,
    component: lazyScreen('NewRoleScreen'),
  });
  const roleRoute = createRoute({
    getParentRoute: () => rolesRoute,
    path: linkEntry(coreLinks.roles.role).path,
  });
  const roleDetailRoute = createRoute({
    getParentRoute: () => roleRoute,
    path: '/',
    validateSearch: rolePageSearch,
    component: lazyScreen('RoleScreen'),
  });
  const editRoleRoute = createRoute({
    getParentRoute: () => roleRoute,
    path: linkEntry(coreLinks.roles.role.edit).path,
    component: lazyScreen('EditRoleScreen'),
  });
  return coreRoute.addChildren([
    articlesRoute.addChildren([
      articleListRoute,
      newArticleRoute,
      articleRoute.addChildren([articleDetailRoute, editArticleRoute]),
    ]),
    usersRoute.addChildren([
      userListRoute,
      newUserRoute,
      userRoute.addChildren([userDetailRoute, addRoleRoute]),
    ]),
    rolesRoute.addChildren([
      roleListRoute,
      newRoleRoute,
      roleRoute.addChildren([roleDetailRoute, editRoleRoute]),
    ]),
  ]);
}
