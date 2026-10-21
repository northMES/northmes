// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  type GanttInventoryFixture,
  type GanttPagesFixture,
  g1Inventory,
  g1Pages,
} from '@northmes/planning-domain';
import { Temporal } from 'temporal-polyfill';
import type { GanttSnapshot } from './gantt-data.ts';
import { g1Snapshot } from './gantt-data-g1.ts';
import {
  InventoryForbidden,
  type InventorySnapshot,
  type InventorySource,
  type PlannedMovement,
} from './inventory-data.ts';

/** A quantity rounded to the thousandth, so 1 200 × 0,085 m is 102 m and not 102.00000000000001. */
function rounded(quantity: number): number {
  return Math.round(quantity * 1000) / 1000;
}

/** The instant a plant date starts, where an ERP date without a time sorts (plan 07). */
function startOfDay(date: string, timeZone: string): number {
  return Temporal.PlainDate.from(date).toZonedDateTime({ timeZone }).epochMilliseconds;
}

/**
 * The movements planning derives from the plan (plan 07, Material warnings): each operation's
 * material consumed at the earliest setup start of its job orders, each order's output at the
 * latest end of its last operation, an unplaced order's movement at its deadline date as the ERP
 * would date it, and each customer order line's demand at its wanted date.
 */
function derivedMovements(
  plan: GanttSnapshot,
  pages: GanttPagesFixture,
  inventory: GanttInventoryFixture,
): PlannedMovement[] {
  const timeZone = plan.plant.timeZone;
  const numberOf = new Map(inventory.articles.map((article) => [article.name, article.number]));
  const customers = new Map(pages.customers.map((customer) => [customer.code, customer.name]));
  const movements: PlannedMovement[] = [];
  for (const order of plan.productionOrders) {
    for (const material of inventory.operationMaterials) {
      if (material.article !== order.article) continue;
      const operation = order.operations.find((each) => each.sequence === material.sequence);
      if (operation === undefined) continue;
      const rows = order.jobOrders.filter((row) => row.operationId === operation.id);
      const starts = rows.flatMap((row) =>
        row.placement === undefined ? [] : [row.placement.setupStartMs],
      );
      const first = rows.find((row) => row.placement?.setupStartMs === Math.min(...starts));
      movements.push({
        id: `consumption-${operation.id}`,
        kind: 'consumption',
        article: material.material,
        warehouse: material.warehouse,
        quantity: -rounded(operation.quantity * material.perPiece),
        atMs: starts.length === 0 ? startOfDay(order.deadlineDate, timeZone) : Math.min(...starts),
        dateOnly: starts.length === 0,
        dateFrom: starts.length === 0 ? 'ERP date' : `Setup start of ${operation.displayNumber}`,
        reference: operation.displayNumber,
        jobOrder: {
          id: first?.id ?? operation.id,
          displayNumber: operation.displayNumber,
          operationName: operation.name,
          orderId: order.id,
          article: order.article,
          ...(first?.equipment !== undefined && {
            machine:
              plan.equipment.find((machine) => machine.code === first.equipment)?.name ??
              first.equipment,
          }),
        },
        counted: true,
      });
    }
    const last = [...order.operations].sort((a, b) => b.sequence - a.sequence)[0];
    const ends = order.jobOrders.flatMap((row) =>
      row.operationId === last?.id && row.placement !== undefined ? [row.placement.endMs] : [],
    );
    const article = numberOf.get(order.article);
    if (article === undefined) continue;
    movements.push({
      id: `output-${order.number}`,
      kind: 'output',
      article,
      warehouse: inventory.outputWarehouse,
      quantity: order.quantity,
      atMs: ends.length === 0 ? startOfDay(order.deadlineDate, timeZone) : Math.max(...ends),
      dateOnly: ends.length === 0,
      dateFrom: ends.length === 0 ? 'ERP date' : `End of ${last?.displayNumber ?? order.number}`,
      reference: order.number,
      productionOrder: { id: order.id, number: order.number },
      counted: true,
    });
  }
  for (const line of pages.customerOrderLines) {
    const article = numberOf.get(line.article);
    if (article === undefined) continue;
    movements.push({
      id: `demand-${line.customerOrder}-${line.line}`,
      kind: 'customerDemand',
      article,
      warehouse: inventory.outputWarehouse,
      quantity: -line.quantity,
      atMs: startOfDay(line.wantedDate, timeZone),
      dateOnly: true,
      dateFrom: 'ERP date',
      reference: `Customer order ${line.customerOrder} line ${line.line}`,
      customerOrderLine: {
        customerOrder: line.customerOrder,
        line: line.line,
        customerName: customers.get(line.customer) ?? line.customer,
      },
      counted: true,
    });
  }
  return movements;
}

/**
 * The inventory snapshot of the fixture G1 at its plant, with the pages and inventory fixtures
 * beside it: the company's warehouses, the articles, every stock balance, and the plant's planned
 * movements up to the end of the projection. The ERP's own movements keep their date, an overdue
 * one moves to now, and purchase requisitions count as the plant setting says (plan 07).
 */
export function g1InventorySnapshot(
  plan: GanttSnapshot = g1Snapshot(),
  pages: GanttPagesFixture = g1Pages,
  inventory: GanttInventoryFixture = g1Inventory,
): InventorySnapshot {
  const timeZone = plan.plant.timeZone;
  const projectedToMs = startOfDay(
    Temporal.PlainDate.from(inventory.projectedTo).add({ days: 1 }).toString(),
    timeZone,
  );
  const mapped = new Set(
    inventory.warehouses
      .filter((warehouse) => warehouse.plant === plan.plant.slug)
      .map((warehouse) => warehouse.code),
  );
  const today = Temporal.Instant.fromEpochMilliseconds(plan.nowMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
  const erp: PlannedMovement[] = inventory.plannedMovements.map((movement, index) => {
    const dayMs = startOfDay(movement.date, timeZone);
    // A movement whose ERP date has passed is counted at now (plan 07).
    const overdue = movement.date < today;
    return {
      id: `erp-${index}`,
      kind: movement.kind,
      article: movement.article,
      warehouse: movement.warehouse,
      quantity: movement.quantity,
      atMs: overdue ? plan.nowMs : dayMs,
      dateOnly: !overdue,
      dateFrom: overdue ? 'Now, overdue' : 'ERP date',
      ...(overdue && { overdueSince: movement.date }),
      reference: movement.reference,
      counted: movement.kind !== 'purchaseRequisition' || inventory.countPurchaseRequisitions,
    };
  });
  const movements = [...erp, ...derivedMovements(plan, pages, inventory)].filter(
    (movement) => mapped.has(movement.warehouse) && movement.atMs < projectedToMs,
  );
  return {
    ...(plan.fixture !== undefined && { fixture: plan.fixture }),
    plant: {
      slug: plan.plant.slug,
      name: pages.plants.find((plant) => plant.slug === plan.plant.slug)?.name ?? plan.plant.slug,
      timeZone,
    },
    nowMs: plan.nowMs,
    stockAsOfMs: Date.parse(inventory.stockImport.asOf.instant),
    nextImportMs: Date.parse(inventory.stockImport.next.instant),
    projectedToMs,
    projectedTo: inventory.projectedTo,
    countPurchaseRequisitions: inventory.countPurchaseRequisitions,
    warehouses: inventory.warehouses.map(({ code, name, plant }) => ({ code, name, plant })),
    articles: inventory.articles,
    balances: inventory.stock,
    movements,
  };
}

/** A load that never answers: the loading state of a page while it waits for the server (ST4). */
const never = new Promise<InventorySnapshot>(() => {});

/**
 * The mock data source of the stock pages (design #729): every load answers with the fixture G1
 * and its pages and inventory fixtures, or with the page state the URL's preview asks for, so the
 * product owner opens the loading, empty, failed and no-access states on mock data.
 */
export const g1InventorySource: InventorySource = {
  load: async ({ preview }) => {
    switch (preview) {
      case 'loading':
        return never;
      case 'empty':
        return { ...g1InventorySnapshot(), balances: [], movements: [] };
      case 'error':
        throw new Error('The stock could not be loaded');
      case 'forbidden':
        throw new InventoryForbidden();
      default:
        return g1InventorySnapshot();
    }
  },
};
