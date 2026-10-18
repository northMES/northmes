// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import type {
  CustomerOrderLine,
  GanttJobOrder,
  GanttOrder,
  GanttSnapshot,
  OrderAnalysis,
} from './gantt-data.ts';
import { plantDateOf } from './timeline/time-scale.ts';

/** The facts of an order that the order page and the lists share. */

/** The machine's name by its code, or the code where the snapshot does not name it. */
export function machineNamer(snapshot: GanttSnapshot): (code: string | undefined) => string {
  const names = new Map(snapshot.equipment.map((machine) => [machine.code, machine.name]));
  return (code) => (code === undefined ? 'Not placed' : (names.get(code) ?? code));
}

/** The order with this id in the snapshot, if any. */
export function orderById(snapshot: GanttSnapshot, orderId: string): GanttOrder | undefined {
  return snapshot.productionOrders.find((order) => order.id === orderId);
}

/** The customer order lines an order supplies, in the fixture's order. */
export function demandOf(snapshot: GanttSnapshot, order: GanttOrder): CustomerOrderLine[] {
  return (snapshot.customerOrderLines ?? []).filter((line) => line.productionOrderId === order.id);
}

/** The customers of an order's demand, each once, in the order of its lines. */
export function customersOf(snapshot: GanttSnapshot, order: GanttOrder): string[] {
  const names = new Map(
    (snapshot.customers ?? []).map((customer) => [customer.code, customer.name]),
  );
  return [
    ...new Set(
      demandOf(snapshot, order).map((line) => names.get(line.customerCode) ?? line.customerCode),
    ),
  ];
}

/** "From the ERP" or "NorthMES": where the order's master fields come from. */
export function ownerLabel(order: GanttOrder): string {
  return order.origin?.owner === 'northmes' ? 'NorthMES' : 'From the ERP';
}

/** The planned start of an order: its analysis, else the earliest setup start of its rows. */
export function plannedStartOf(
  order: GanttOrder,
  analysis: OrderAnalysis | undefined,
): number | undefined {
  if (analysis?.plannedStartMs !== undefined) return analysis.plannedStartMs;
  const starts = order.jobOrders.flatMap((row) =>
    row.placement === undefined ? [] : [row.placement.setupStartMs],
  );
  return starts.length === 0 ? undefined : Math.min(...starts);
}

/**
 * The timeline pages at an order (plan 18, Zoom to order): the Gantt and the board with `order`
 * set and the range at the order's planned start, so the order's span is in view.
 */
export function timelineLinks(snapshot: GanttSnapshot, order: GanttOrder, plant: string) {
  const start = plannedStartOf(order, snapshot.analysis.orders[order.id]);
  const search = {
    zoom: 'week',
    from: plantDateOf(start ?? snapshot.nowMs, snapshot.plant.timeZone),
    order: order.id,
  };
  return {
    gantt: planningLinks.gantt({ plant }, search).href,
    board: planningLinks.board({ plant }, search).href,
    order: planningLinks.orders.order({ plant, orderId: order.id }).href,
  };
}

/** "Late by 15 h 15 min" for a late order, "1 day 4 h 15 min before the deadline" otherwise. */
export function slackText(analysis: OrderAnalysis | undefined): string {
  if (analysis === undefined) return '';
  return analysis.late
    ? `Late by ${formatDuration(-analysis.slackElapsedS)}`
    : `${formatDuration(analysis.slackElapsedS)} before the deadline`;
}

/** The status of an operation from its job orders: started when one is, finished when all are. */
export function operationStatus(rows: readonly GanttJobOrder[]): string {
  if (rows.length > 0 && rows.every((row) => row.status === 'finished')) return 'finished';
  if (rows.some((row) => row.status === 'started')) return 'started';
  return 'planned';
}

/** "Mon 2 Nov 06:40" in plant time, for the lines that name an instant. */
export function plantTime(snapshot: GanttSnapshot, epochMs: number): string {
  return formatPlantDateTime(epochMs, snapshot.plant.timeZone);
}
