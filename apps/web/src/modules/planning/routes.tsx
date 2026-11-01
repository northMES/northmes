// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { linkEntry } from '@northmes/contracts';
import { planningLinks } from '@northmes/planning-contracts';
import type { PlantRoute, SettingsRoute } from '@northmes/web-sdk';
import { createRoute, lazyRouteComponent, Outlet } from '@tanstack/react-router';
import { boardFieldsSearch } from './board-fields-search.ts';
import { customerOrderPageSearch } from './customer-order-page-search.ts';
import { boardSearch, ganttSearch } from './gantt-search.ts';
import { jobOrdersSearch } from './job-orders-search.ts';
import { newCustomerOrderSearch, newOrderSearch } from './new-order-search.ts';
import { customerOrderListSearch, orderListSearch, urlSearchOf } from './order-list-search.ts';
import { orderPageSearch } from './order-page-search.ts';
import { createDraftStore, PlanningDraftProvider } from './planning-draft.tsx';
import { planningRulesSearch } from './planning-rules-search.ts';
import {
  stockArticleSearch,
  stockSearch,
  urlSearchOf as urlSearchOfStock,
} from './stock-search.ts';

/**
 * The planning module's routes under the shell's $plant route. Each route takes its path from its
 * entry in planningLinks, so a path is written once, in the link manifest (ADR 0062). The top
 * route's path is the manifest's own, the module id. The screens load lazily from screens.ts. The
 * Gantt page keeps its view state in the URL: zoom, from, order and chain (plan 18); the board
 * route keeps the same keys. The top route holds the planner's drafts for the pages under it.
 */
export function planningRoutes(plantRoute: PlantRoute) {
  // The planner's drafts live as long as the router, so a move made on one planning page shows on
  // the others and stays while the planner visits a page of another module.
  const drafts = createDraftStore();
  const planningRoute = createRoute({
    getParentRoute: () => plantRoute,
    path: linkEntry(planningLinks).path,
    component: () => (
      <PlanningDraftProvider store={drafts}>
        <Outlet />
      </PlanningDraftProvider>
    ),
  });
  const boardRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.board).path,
    validateSearch: boardSearch,
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
  // The job order table keeps its view as the order lists do, with no range (ADR 0091), and its
  // filters as the URL's comma lists.
  const jobOrdersRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.jobOrders).path,
    validateSearch: (raw: Record<string, unknown>) => urlSearchOf(jobOrdersSearch(raw)),
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
  // New production order and New customer order (design #768), on the in-memory store of
  // orders entered by hand until the planning server's commands exist.
  const newOrderRoute = createRoute({
    getParentRoute: () => ordersRoute,
    path: linkEntry(planningLinks.orders.new).path,
    validateSearch: newOrderSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'NewOrderScreen'),
  });
  const newCustomerOrderRoute = createRoute({
    getParentRoute: () => customerOrdersRoute,
    path: linkEntry(planningLinks.customerOrders.new).path,
    validateSearch: newCustomerOrderSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'NewCustomerOrderScreen'),
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
  // The stock of the plant and of one article (design #729), read-only, on the fixture G1.
  const stockRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.stock).path,
  });
  const stockListRoute = createRoute({
    getParentRoute: () => stockRoute,
    path: '/',
    validateSearch: (raw: Record<string, unknown>) => urlSearchOfStock(stockSearch(raw)),
    component: lazyRouteComponent(() => import('./screens.ts'), 'StockScreen'),
  });
  const stockArticleRoute = createRoute({
    getParentRoute: () => stockRoute,
    path: linkEntry(planningLinks.stock.article).path,
    validateSearch: stockArticleSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'StockArticleScreen'),
  });
  return planningRoute.addChildren([
    boardRoute,
    releaseRoute,
    ganttRoute,
    jobOrdersRoute,
    ordersRoute.addChildren([
      orderListRoute,
      newOrderRoute,
      orderRoute.addChildren([orderPageRoute, editOrderRoute]),
    ]),
    customerOrdersRoute.addChildren([
      customerOrderListRoute,
      newCustomerOrderRoute,
      customerOrderRoute,
    ]),
    stockRoute.addChildren([stockListRoute, stockArticleRoute]),
  ]);
}

/**
 * The planning module's settings routes under the shell's /$plant/settings route (ADR 0066, #876):
 * the planning rules at /plant-a/settings/planning (plan 06; #766) and the board fields (#762), on
 * the fixture G1 and the in-memory stores until planning settings have their API. Each page takes
 * the state the URL previews. The top route's path is the settings section's own, the module id.
 */
export function planningSettingsRoutes(settingsRoute: SettingsRoute) {
  const planningRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: linkEntry(planningLinks.settings).path,
  });
  const planningRulesRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: '/',
    validateSearch: planningRulesSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'PlanningRulesScreen'),
  });
  const boardFieldsRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.settings.boardFields).path,
    validateSearch: boardFieldsSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'BoardFieldsScreen'),
  });
  return planningRoute.addChildren([planningRulesRoute, boardFieldsRoute]);
}
