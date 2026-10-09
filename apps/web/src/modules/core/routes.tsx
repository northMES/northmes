// SPDX-License-Identifier: AGPL-3.0-or-later
import { linkEntry } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import { coreModuleId, type PlantRoute, type SettingsRoute } from '@northmes/web-sdk';
import {
  type AnyRoute,
  createRoute,
  lazyRouteComponent,
  type ParsedLocation,
  redirect,
} from '@tanstack/react-router';
import { newRoleSearch, rolePageSearch, userPageSearch } from './access-search.ts';
import { articleListSearch } from './article-list-search.ts';
import { roleListSearch } from './role-list-search.ts';
import { userListSearch } from './user-list-search.ts';

/** A screen of screens.ts as a route component, which loads the screens' chunk on first use. */
function lazyScreen(name: keyof typeof import('./screens.ts')) {
  return lazyRouteComponent(() => import('./screens.ts'), name);
}

/**
 * The route that leads a URL with core after its parent's path, as bookmarks from before ADR 0074
 * hold, to the same page without it, with its search and hash: /plant-a/core/articles?q=hinge
 * leads to /plant-a/articles?q=hinge. `at` is the index of the core segment in the path's
 * segments, 2 under /$plant and 3 under /settings/$companyId.
 */
function withoutCoreSegment(parent: AnyRoute, at: number) {
  return createRoute({
    getParentRoute: () => parent,
    path: `${coreModuleId}/$`,
    beforeLoad: ({ location }: { readonly location: ParsedLocation }) => {
      const pathname = location.pathname
        .split('/')
        .filter((_, index) => index !== at)
        .join('/');
      const hash = location.hash === '' ? '' : `#${location.hash}`;
      throw redirect({ href: `${pathname}${location.searchStr}${hash}`, replace: true });
    },
  });
}

/**
 * The core module's routes under the shell's $plant route: the articles, and People in plant
 * settings (ADR 0066). The top route is pathless, so core's pages sit at the plant root, as
 * /plant-a/articles, and the old URLs with core in them lead there (ADR 0074). Each route takes its
 * path from its entry in coreLinks, so a path is written once, in the link manifest (ADR 0062); a
 * list and a record's page are the index routes of their entries. Each search definition sits on
 * its route, never in the lazy screens.ts, from which the screens load.
 */
export function coreRoutes(plantRoute: PlantRoute) {
  const coreRoute = createRoute({ getParentRoute: () => plantRoute, id: coreModuleId });
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
  const peopleRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.people).path,
  });
  const peopleListRoute = createRoute({
    getParentRoute: () => peopleRoute,
    path: '/',
    component: lazyScreen('PeopleScreen'),
  });
  const peopleAddRoleRoute = createRoute({
    getParentRoute: () => peopleRoute,
    path: linkEntry(coreLinks.people.addRole).path,
    component: lazyScreen('PeopleAddRoleScreen'),
  });
  const personRoute = createRoute({
    getParentRoute: () => peopleRoute,
    path: linkEntry(coreLinks.people.person).path,
    component: lazyScreen('PersonScreen'),
  });
  return coreRoute.addChildren([
    withoutCoreSegment(coreRoute, 2),
    articlesRoute.addChildren([
      articleListRoute,
      newArticleRoute,
      articleRoute.addChildren([articleDetailRoute, editArticleRoute]),
    ]),
    peopleRoute.addChildren([peopleListRoute, peopleAddRoleRoute, personRoute]),
  ]);
}

/**
 * The core module's company settings routes under the shell's /settings/$companyId route (ADR
 * 0066): the users with a user's page and Add role, and the roles with a role's page and its
 * editor. Their paths come from the settings section of coreLinks. The top route is pathless, so
 * the users sit at /settings/<company id>/users, and the old URLs with core in them lead there
 * (ADR 0074).
 */
export function coreSettingsRoutes(settingsRoute: SettingsRoute) {
  const coreRoute = createRoute({ getParentRoute: () => settingsRoute, id: coreModuleId });
  const usersRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.settings.users).path,
  });
  const userListRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: '/',
    validateSearch: userListSearch,
    component: lazyScreen('UsersScreen'),
  });
  const newUserRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: linkEntry(coreLinks.settings.users.new).path,
    component: lazyScreen('NewUserScreen'),
  });
  const userRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: linkEntry(coreLinks.settings.users.user).path,
  });
  const userDetailRoute = createRoute({
    getParentRoute: () => userRoute,
    path: '/',
    validateSearch: userPageSearch,
    component: lazyScreen('UserScreen'),
  });
  const addRoleRoute = createRoute({
    getParentRoute: () => userRoute,
    path: linkEntry(coreLinks.settings.users.user.addRole).path,
    component: lazyScreen('AddRoleScreen'),
  });
  const rolesRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.settings.roles).path,
  });
  const roleListRoute = createRoute({
    getParentRoute: () => rolesRoute,
    path: '/',
    // Search, Defined by and the sort live in the URL; a key that does not apply falls back.
    validateSearch: roleListSearch,
    component: lazyScreen('RolesScreen'),
  });
  const newRoleRoute = createRoute({
    getParentRoute: () => rolesRoute,
    path: linkEntry(coreLinks.settings.roles.new).path,
    validateSearch: newRoleSearch,
    component: lazyScreen('NewRoleScreen'),
  });
  const roleRoute = createRoute({
    getParentRoute: () => rolesRoute,
    path: linkEntry(coreLinks.settings.roles.role).path,
  });
  const roleDetailRoute = createRoute({
    getParentRoute: () => roleRoute,
    path: '/',
    validateSearch: rolePageSearch,
    component: lazyScreen('RoleScreen'),
  });
  const editRoleRoute = createRoute({
    getParentRoute: () => roleRoute,
    path: linkEntry(coreLinks.settings.roles.role.edit).path,
    component: lazyScreen('EditRoleScreen'),
  });
  return coreRoute.addChildren([
    withoutCoreSegment(coreRoute, 3),
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
