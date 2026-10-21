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
import { roundQuantity } from './material-projection.ts';

/** The instant a plant date starts, where an ERP date without a time sorts (plan 07). */
function startOfDay(date: string, timeZone: string): number {
  return Temporal.PlainDate.from(date).toZonedDateTime({ timeZone }).epochMilliseconds;
}

/**
 * The movements planning derives from the plan (plan 07, Material warnings): each operation's
 * material consumed at the earliest setup start of its job orders, each order's output at the
 * latest end of its last operation, an order not fully placed at its deadline date, and each
 * customer order line's demand at its wanted date. An operation with a started or finished job
 * order consumes nothing more: the ERP's stock already shows the material it took.
 */
function derivedMovements(
  plan: GanttSnapshot,
  inventory: GanttInventoryFixture,
): PlannedMovement[] {
  const timeZone = plan.plant.timeZone;
  const numberOf = new Map(inventory.articles.map((article) => [article.name, article.number]));
  const customers = new Map((plan.customers ?? []).map((each) => [each.code, each.name]));
  const machineName = (code: string) =>
    plan.equipment.find((machine) => machine.code === code)?.name ?? code;
  const movements: PlannedMovement[] = [];
  for (const order of plan.productionOrders) {
    const deadline = startOfDay(order.deadlineDate, timeZone);
    for (const material of inventory.operationMaterials) {
      if (material.article !== order.article) continue;
      const operation = order.operations.find((each) => each.sequence === material.sequence);
      if (operation === undefined) continue;
      const rows = order.jobOrders.filter((row) => row.operationId === operation.id);
      if (rows.some((row) => row.status !== 'planned')) continue;
      const placed = rows.every((row) => row.placement !== undefined) && rows.length > 0;
      const first = placed
        ? [...rows].sort(
            (a, b) => (a.placement?.setupStartMs ?? 0) - (b.placement?.setupStartMs ?? 0),
          )[0]
        : undefined;
      movements.push({
        id: `consumption-${operation.id}`,
        kind: 'consumption',
        article: material.material,
        warehouse: material.warehouse,
        quantity: -roundQuantity(operation.quantity * material.perPiece),
        atMs: first?.placement?.setupStartMs ?? deadline,
        dateOnly: first === undefined,
        dateFrom:
          first === undefined ? 'Order deadline' : `Setup start of ${operation.displayNumber}`,
        reference: operation.displayNumber,
        jobOrder: {
          id: first?.id ?? rows[0]?.id ?? operation.id,
          displayNumber: operation.displayNumber,
          operationName: operation.name,
          orderId: order.id,
          article: order.article,
          ...(first?.equipment !== undefined && { machine: machineName(first.equipment) }),
        },
        counted: true,
      });
    }
    const last = [...order.operations].sort((a, b) => b.sequence - a.sequence)[0];
    const lastRows = order.jobOrders.filter((row) => row.operationId === last?.id);
    const placed = lastRows.length > 0 && lastRows.every((row) => row.placement !== undefined);
    const article = numberOf.get(order.article);
    if (article === undefined) continue;
    movements.push({
      id: `output-${order.number}`,
      kind: 'output',
      article,
      warehouse: inventory.outputWarehouse,
      quantity: order.quantity,
      atMs: placed ? Math.max(...lastRows.map((row) => row.placement?.endMs ?? 0)) : deadline,
      dateOnly: !placed,
      dateFrom: placed ? `End of ${last?.displayNumber ?? order.number}` : 'Order deadline',
      reference: order.number,
      productionOrder: { id: order.id, number: order.number },
      counted: true,
    });
  }
  for (const line of plan.customerOrderLines ?? []) {
    const article = numberOf.get(line.article);
    if (article === undefined) continue;
    const order = plan.productionOrders.find((each) => each.id === line.productionOrderId);
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
        customerName: customers.get(line.customerCode) ?? line.customerCode,
        ...(order !== undefined && {
          productionOrder: { id: order.id, number: order.number },
        }),
      },
      counted: true,
    });
  }
  return movements;
}

/** A movement dated before now moves to now, keeping its own date as overdueSince (plan 07). */
function overdueAtNow(movement: PlannedMovement, nowMs: number, timeZone: string): PlannedMovement {
  if (movement.atMs >= nowMs) return movement;
  return {
    ...movement,
    atMs: nowMs,
    dateOnly: false,
    dateFrom: 'Now, overdue',
    overdueSince: Temporal.Instant.fromEpochMilliseconds(movement.atMs)
      .toZonedDateTimeISO(timeZone)
      .toPlainDate()
      .toString(),
  };
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
  const erp: PlannedMovement[] = inventory.plannedMovements.map((movement, index) => ({
    id: `erp-${index}`,
    kind: movement.kind,
    article: movement.article,
    warehouse: movement.warehouse,
    quantity: movement.quantity,
    atMs: startOfDay(movement.date, timeZone),
    dateOnly: true,
    dateFrom: 'ERP date',
    reference: movement.reference,
    counted: movement.kind !== 'purchaseRequisition' || inventory.countPurchaseRequisitions,
  }));
  const movements = [...erp, ...derivedMovements(plan, inventory)]
    .map((movement) => overdueAtNow(movement, plan.nowMs, timeZone))
    .filter((movement) => mapped.has(movement.warehouse) && movement.atMs < projectedToMs);
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
