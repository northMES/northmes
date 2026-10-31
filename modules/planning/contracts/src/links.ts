// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineModuleLinks } from '@northmes/contracts';

/**
 * The planning module's link manifest (ADR 0062). The module's routes in apps/web take their paths
 * from it, and other modules, server code and end-to-end specs build the planning module's URLs
 * with it.
 */
export const planningLinks = defineModuleLinks(
  'planning',
  {
    board: { path: 'board' },
    /**
     * The production orders with Release, the walking-skeleton list that used to be the board: it
     * keeps the real release path until the board's backend stories wire the board (Krister,
     * 2026-10-21).
     */
    release: { path: 'release' },
    /** The order Gantt (plan 18), a page of its own beside the board (Krister, 2026-10-17). */
    gantt: { path: 'gantt' },
    /** The job order table (plan 07, Job order table view), the third page of the timeline. */
    jobOrders: { path: 'job-orders' },
    /** The production orders (plan 07): the list, each order's page (its tab in `tab`) and its edit page. */
    orders: {
      path: 'orders',
      children: {
        /** New production order (design #768), from the list or from a customer order line in `line`. */
        new: { path: 'new' },
        order: { path: '$orderId', children: { edit: { path: 'edit' } } },
      },
    },
    /**
     * The customer order lines and the production orders that supply them (plan 07), and each
     * customer order's page by its number (design #728).
     */
    customerOrders: {
      path: 'customer-orders',
      children: {
        /** New customer order (design #768). */
        new: { path: 'new' },
        customerOrder: { path: '$customerOrderId' },
      },
    },
    /** The stock of the plant and the stock of one article by its number (design #729). */
    stock: { path: 'stock', children: { article: { path: '$articleId' } } },
  },
  {
    /**
     * The planning pages of plant settings, under /<plant>/settings/planning (ADR 0066, #876): the
     * planning rules at the section's root (plan 07, Settings; #766), and the board fields, which
     * choose what a job order block and its hover card show (plan 07, Board settings; #762).
     */
    settings: { rules: { path: '' }, boardFields: { path: 'board-fields' } },
  },
);
