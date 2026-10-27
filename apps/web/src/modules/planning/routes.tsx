// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { linkEntry } from '@northmes/contracts';
import { planningLinks } from '@northmes/planning-contracts';
import type { PlantRoute } from '@northmes/web-sdk';
import { createRoute, lazyRouteComponent, redirect } from '@tanstack/react-router';
import { boardFieldsSearch } from './board-fields-search.ts';
import { customerOrderPageSearch } from './customer-order-page-search.ts';
import { boardSearch, ganttSearch } from './gantt-search.ts';
import { jobOrdersSearch } from './job-orders-search.ts';
import { customerOrderListSearch, orderListSearch, urlSearchOf } from './order-list-search.ts';
import { orderPageSearch } from './order-page-search.ts';

/**
 * The planning module's routes under the shell's $plant route. Each route takes its path from its
 * entry in planningLinks, so a path is written once, in the link manifest (ADR 0062). The top
 * route's path is the manifest's own, the module id. The screens load lazily from screens.ts. The
 * Gantt page keeps its view state in the URL: zoom, from, order and chain (plan 18); the board
 * route keeps the same keys and redirects the view=gantt links from before the Gantt had its own
 * page (Krister, 2026-10-17).
 */
export function planningRoutes(plantRoute: PlantRoute) {
  const planningRoute = createRoute({
    getParentRoute: () => plantRoute,
    path: linkEntry(planningLinks).path,
  });
  const boardRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.board).path,
    validateSearch: boardSearch,
    beforeLoad: ({ search, params }) => {
      if (search.view === 'gantt') {
        const { view: _, ...rest } = search;
        const query = new URLSearchParams(
          Object.entries(rest).map(([key, value]) => [key, String(value)]),
        ).toString();
        const { href } = planningLinks.gantt({ plant: params.plant });
        throw redirect({ href: query === '' ? href : `${href}?${query}`, replace: true });
      }
    },
    component: lazyRouteComponent(() => import('./screens.ts'), 'BoardScreen'),
  });
  // The walking-skeleton list with Release, on a route of its own until the board's backend
  // stories wire the board (Krister, 2026-10-21).
  const releaseRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.release).path,
    component: lazyRouteComponent(() => import('./screens.ts'), 'ReleaseOrdersScreen'),
  });
  const ganttRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.gantt).path,
    validateSearch: ganttSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'GanttScreen'),
  });
  // The job order table keeps zoom and from as the Gantt does, plus Late only and its sort.
  const jobOrdersRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.jobOrders).path,
    validateSearch: jobOrdersSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'JobOrdersScreen'),
  });
  // The production orders: the list (its index route comes with the lists), each order's page
  // with its open tab in the URL (design ui-222), and its edit page.
  const ordersRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.orders).path,
  });
  // The list keeps its filters as the URL's comma lists, so the router writes them back as such.
  const orderListRoute = createRoute({
    getParentRoute: () => ordersRoute,
    path: '/',
    validateSearch: (raw: Record<string, unknown>) => urlSearchOf(orderListSearch(raw)),
    component: lazyRouteComponent(() => import('./screens.ts'), 'ProductionOrdersScreen'),
  });
  // The customer orders: the list of their lines and each customer order's page (design #728),
  // with its open tab and its Supply from an order step in the URL.
  const customerOrdersRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.customerOrders).path,
  });
  const customerOrderListRoute = createRoute({
    getParentRoute: () => customerOrdersRoute,
    path: '/',
    validateSearch: (raw: Record<string, unknown>) => urlSearchOf(customerOrderListSearch(raw)),
    component: lazyRouteComponent(() => import('./screens.ts'), 'CustomerOrdersScreen'),
  });
  const customerOrderRoute = createRoute({
    getParentRoute: () => customerOrdersRoute,
    path: linkEntry(planningLinks.customerOrders.customerOrder).path,
    validateSearch: customerOrderPageSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'CustomerOrderScreen'),
  });
  const orderRoute = createRoute({
    getParentRoute: () => ordersRoute,
    path: linkEntry(planningLinks.orders.order).path,
  });
  const orderPageRoute = createRoute({
    getParentRoute: () => orderRoute,
    path: '/',
    validateSearch: orderPageSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'OrderScreen'),
  });
  const editOrderRoute = createRoute({
    getParentRoute: () => orderRoute,
    path: linkEntry(planningLinks.orders.order.edit).path,
    component: lazyRouteComponent(() => import('./screens.ts'), 'EditOrderScreen'),
  });
  // Plant settings (ADR 0066; #762): the board fields, on the fixture G1 and the in-memory store
  // until planning settings have their API. The page takes the state the URL previews.
  const settingsRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.settings).path,
  });
  const boardFieldsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: linkEntry(planningLinks.settings.boardFields).path,
    validateSearch: boardFieldsSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'BoardFieldsScreen'),
  });
  return planningRoute.addChildren([
    boardRoute,
    releaseRoute,
    ganttRoute,
    jobOrdersRoute,
    ordersRoute.addChildren([
      orderListRoute,
      orderRoute.addChildren([orderPageRoute, editOrderRoute]),
    ]),
    customerOrdersRoute.addChildren([customerOrderListRoute, customerOrderRoute]),
    settingsRoute.addChildren([boardFieldsRoute]),
  ]);
}
