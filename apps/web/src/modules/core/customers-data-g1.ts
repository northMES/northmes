// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  floatOf,
  type GanttFixture,
  type GanttPagesFixture,
  g1,
  g1OrderId,
  g1Pages,
  g1PlanContext,
} from '@northmes/planning-domain';
import type { CustomerLineSupply, CustomersSnapshot, CustomersSource } from './customers-data.ts';

/**
 * The customers snapshot of the fixture G1 with the pages fixture beside it: the four customers,
 * all from the ERP, and their customer order lines, each with the order of G1 that supplies it and
 * that order's float from the domain's floatOf, the function the Gantt's analysis reads, so a line
 * is late here exactly when the customer orders list says so.
 */
export function g1CustomersSnapshot(
  fixture: GanttFixture = g1,
  pages: GanttPagesFixture = g1Pages,
): CustomersSnapshot {
  const context = g1PlanContext(fixture);
  const supplies = new Map<string, CustomerLineSupply>();
  for (const order of fixture.productionOrders) {
    const plan = context.orders.find((each) => each.id === g1OrderId(order.number));
    if (plan === undefined) continue;
    const float = floatOf(plan, context);
    supplies.set(order.number, {
      orderId: plan.id,
      number: order.number,
      status: order.status,
      deadlineMs: plan.deadlineMs,
      ...(float.plannedStartMs !== undefined && { plannedStartMs: float.plannedStartMs }),
      ...(float.plannedEndMs !== undefined && { plannedEndMs: float.plannedEndMs }),
      late: float.late,
      slackElapsedS: float.slackElapsedS,
    });
  }
  return {
    fixture: fixture.id,
    plant: { slug: fixture.plant.slug, timeZone: fixture.plant.timeZone },
    nowMs: Date.parse(fixture.now.instant),
    erp: {
      name: pages.erp.connectionName,
      importedAtMs: Date.parse(pages.erp.importedAt.instant),
    },
    customers: pages.customers.map((customer) => ({ ...customer, owner: 'erp' })),
    lines: pages.customerOrderLines.map((line) => {
      const supply = line.productionOrder === null ? undefined : supplies.get(line.productionOrder);
      return {
        id: `${line.customerOrder}-${line.line}`,
        customerOrder: line.customerOrder,
        customersReference: line.customersReference,
        customerCode: line.customer,
        line: line.line,
        article: line.article,
        quantity: line.quantity,
        wantedDate: line.wantedDate,
        ...(supply !== undefined && { supply }),
      };
    }),
  };
}

/** A load that never answers: the loading state of a page while it waits for the server (CU3, CC5). */
const never = new Promise<CustomersSnapshot>(() => {});

/**
 * The mock data source of the customers pages (design #728): every load answers with the fixture
 * G1 and the pages fixture, or with the page state the URL's preview asks for, so the product owner
 * opens the loading, empty and failed states on mock data. The pages show "Showing fixture G1"
 * while it is in use.
 */
export const g1CustomersSource: CustomersSource = {
  load: async ({ preview }) => {
    switch (preview) {
      case 'loading':
        return never;
      case 'empty': {
        // No import has run, so there is no ERP data to date either (CU4).
        const { erp: _, ...snapshot } = g1CustomersSnapshot();
        return { ...snapshot, customers: [], lines: [] };
      }
      case 'error':
        throw new Error('The customers could not be loaded');
      default:
        return g1CustomersSnapshot();
    }
  },
};
