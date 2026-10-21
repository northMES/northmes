// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
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
import { dashboardSearch, newRoleSearch, rolePageSearch, userPageSearch } from './access-search.ts';
import { articleListSearch, urlSearchOf } from './article-list-search.ts';
import {
  customerListSearch,
  customerPageSearch,
  urlSearchOf as urlSearchOfCustomerList,
} from './customer-list-search.ts';
import {
  calendarPageSearch,
  machineListSearch,
  machinePageSearch,
  urlSearchOf as urlSearchOfMachineList,
} from './plant-settings-search.ts';
import { roleListSearch } from './role-list-search.ts';
import { routingPageSearch } from './routing-search.ts';
import { toolListSearch } from './tool-list-search.ts';
import { userListSearch } from './user-list-search.ts';
import {
  urlSearchOf as urlSearchOfWarehouseList,
  warehouseListSearch,
} from './warehouse-list-search.ts';

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
 * The core module's routes under the shell's $plant route: the dashboard, the plant's landing page
 * (ADR 0078), the articles, the article groups, the customers, and People, the machines and the
 * calendars in plant settings (ADR 0066). The top route is pathless, so core's pages sit at the plant
 * root, as /plant-a/articles, and the old URLs with core in them lead there (ADR 0074). Each route
 * takes its path from its entry in coreLinks, so a path is written once, in the link manifest (ADR
 * 0062); a list and a record's page are the index routes of their entries. Each search definition
 * sits on its route, never in the lazy screens.ts, from which the screens load.
 */
export function coreRoutes(plantRoute: PlantRoute) {
  const coreRoute = createRoute({ getParentRoute: () => plantRoute, id: coreModuleId });
  // The dashboard is the plant's landing page, at the plant root, with its open tab in the URL
  // (ADR 0078, design shell-454).
  const dashboardRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: '/',
    validateSearch: dashboardSearch,
    component: lazyScreen('DashboardScreen'),
  });
  const articlesRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.articles).path,
  });
  const articleListRoute = createRoute({
    getParentRoute: () => articlesRoute,
    path: '/',
    // Search, sort and page live in the URL; a key that does not apply falls back on its own.
    // The route keeps the filters as the URL's comma lists, so the router writes them back as
    // such; the screen reads the view from them.
    validateSearch: (raw: Record<string, unknown>) => urlSearchOf(articleListSearch(raw)),
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
  const articleGroupsRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.articleGroups).path,
  });
  const articleGroupListRoute = createRoute({
    getParentRoute: () => articleGroupsRoute,
    path: '/',
    component: lazyScreen('ArticleGroupsScreen'),
  });
  const newArticleGroupRoute = createRoute({
    getParentRoute: () => articleGroupsRoute,
    path: linkEntry(coreLinks.articleGroups.new).path,
    component: lazyScreen('NewArticleGroupScreen'),
  });
  const articleGroupRoute = createRoute({
    getParentRoute: () => articleGroupsRoute,
    path: linkEntry(coreLinks.articleGroups.articleGroup).path,
    component: lazyScreen('ArticleGroupScreen'),
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
  });
  const personDetailRoute = createRoute({
    getParentRoute: () => personRoute,
    path: '/',
    component: lazyScreen('PersonScreen'),
  });
  const personAddRoleRoute = createRoute({
    getParentRoute: () => personRoute,
    path: linkEntry(coreLinks.people.person.addRole).path,
    component: lazyScreen('PersonAddRoleScreen'),
  });
  // Plant settings (ADR 0066; design #688): the machines with each machine's page and its edit
  // page, and the calendars with each calendar's page. The list and the forms take the page state
  // the mock source previews from the URL; a calendar's page keeps the week its week view shows.
  const machinesRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.machines).path,
  });
  const machineListRoute = createRoute({
    getParentRoute: () => machinesRoute,
    path: '/',
    validateSearch: (raw: Record<string, unknown>) =>
      urlSearchOfMachineList(machineListSearch(raw)),
    component: lazyScreen('MachinesScreen'),
  });
  const machineRoute = createRoute({
    getParentRoute: () => machinesRoute,
    path: linkEntry(coreLinks.machines.machine).path,
  });
  const machineDetailRoute = createRoute({
    getParentRoute: () => machineRoute,
    path: '/',
    validateSearch: machinePageSearch,
    component: lazyScreen('MachineScreen'),
  });
  const editMachineRoute = createRoute({
    getParentRoute: () => machineRoute,
    path: linkEntry(coreLinks.machines.machine.edit).path,
    validateSearch: machinePageSearch,
    component: lazyScreen('EditMachineScreen'),
  });
  const calendarsRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.calendars).path,
  });
  const calendarListRoute = createRoute({
    getParentRoute: () => calendarsRoute,
    path: '/',
    validateSearch: calendarPageSearch,
    component: lazyScreen('CalendarsScreen'),
  });
  const calendarRoute = createRoute({
    getParentRoute: () => calendarsRoute,
    path: linkEntry(coreLinks.calendars.calendar).path,
    validateSearch: calendarPageSearch,
    component: lazyScreen('CalendarScreen'),
  });
  // The customers register under Master data (design #728), on the fixture G1 until customers have
  // their API.
  const customersRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.customers).path,
  });
  const customerListRoute = createRoute({
    getParentRoute: () => customersRoute,
    path: '/',
    validateSearch: (raw: Record<string, unknown>) =>
      urlSearchOfCustomerList(customerListSearch(raw)),
    component: lazyScreen('CustomersScreen'),
  });
  const customerRoute = createRoute({
    getParentRoute: () => customersRoute,
    path: linkEntry(coreLinks.customers.customer).path,
    validateSearch: customerPageSearch,
    component: lazyScreen('CustomerScreen'),
  });
  // The routings register under Master data (design #729), on the fixture G1 until core's
  // routing API.
  const routingsRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.routings).path,
  });
  const routingListRoute = createRoute({
    getParentRoute: () => routingsRoute,
    path: '/',
    validateSearch: routingPageSearch,
    component: lazyScreen('RoutingsScreen'),
  });
  const routingRoute = createRoute({
    getParentRoute: () => routingsRoute,
    path: linkEntry(coreLinks.routings.routing).path,
  });
  const routingDetailRoute = createRoute({
    getParentRoute: () => routingRoute,
    path: '/',
    validateSearch: routingPageSearch,
    component: lazyScreen('RoutingScreen'),
  });
  const editRoutingOperationRoute = createRoute({
    getParentRoute: () => routingRoute,
    path: linkEntry(coreLinks.routings.routing.editOperation).path,
    validateSearch: routingPageSearch,
    component: lazyScreen('EditRoutingOperationScreen'),
  });
  // The tools register under Master data (design #729), on the fixture G1 until core's tool API.
  const toolsRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.tools).path,
  });
  const toolListRoute = createRoute({
    getParentRoute: () => toolsRoute,
    path: '/',
    validateSearch: toolListSearch,
    component: lazyScreen('ToolsScreen'),
  });
  const toolRoute = createRoute({
    getParentRoute: () => toolsRoute,
    path: linkEntry(coreLinks.tools.tool).path,
    validateSearch: toolListSearch,
    component: lazyScreen('ToolScreen'),
  });
  return coreRoute.addChildren([
    withoutCoreSegment(coreRoute, 2),
    dashboardRoute,
    articlesRoute.addChildren([
      articleListRoute,
      newArticleRoute,
      articleRoute.addChildren([articleDetailRoute, editArticleRoute]),
    ]),
    articleGroupsRoute.addChildren([
      articleGroupListRoute,
      newArticleGroupRoute,
      articleGroupRoute,
    ]),
    peopleRoute.addChildren([
      peopleListRoute,
      peopleAddRoleRoute,
      personRoute.addChildren([personDetailRoute, personAddRoleRoute]),
    ]),
    machinesRoute.addChildren([
      machineListRoute,
      machineRoute.addChildren([machineDetailRoute, editMachineRoute]),
    ]),
    calendarsRoute.addChildren([calendarListRoute, calendarRoute]),
    customersRoute.addChildren([customerListRoute, customerRoute]),
    toolsRoute.addChildren([toolListRoute, toolRoute]),
    routingsRoute.addChildren([
      routingListRoute,
      routingRoute.addChildren([routingDetailRoute, editRoutingOperationRoute]),
    ]),
  ]);
}

/**
 * The core module's company settings routes under the shell's /settings/$companyId route (ADR
 * 0066): the users with a user's page and Add role, the roles with a role's page and its editor,
 * and the warehouses. Their paths come from the settings section of coreLinks. The top route is
 * pathless, so the users sit at /settings/<company id>/users, and the old URLs with core in them
 * lead there (ADR 0074).
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
  // The company's warehouses (design #729), on the inventory fixture until core's warehouse API.
  const warehousesRoute = createRoute({
    getParentRoute: () => coreRoute,
    path: linkEntry(coreLinks.settings.warehouses).path,
    validateSearch: (raw: Record<string, unknown>) =>
      urlSearchOfWarehouseList(warehouseListSearch(raw)),
    component: lazyScreen('WarehousesScreen'),
  });
  return coreRoute.addChildren([
    withoutCoreSegment(coreRoute, 3),
    warehousesRoute,
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
