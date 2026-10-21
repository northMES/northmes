// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// What New production order and New customer order read from the plan (#768): which numbers are
// taken, what an open order still has free for a customer order line, and the lines that need one.
import type { CustomerOrderLine, GanttOrder, GanttSnapshot } from './gantt-data.ts';

/** Whether a production order of the plant already has this number. */
export function productionOrderNumberTaken(snapshot: GanttSnapshot, number: string): boolean {
  return snapshot.productionOrders.some((order) => order.number === number);
}

/** Whether a customer order already has this number. */
export function customerOrderNumberTaken(snapshot: GanttSnapshot, number: string): boolean {
  return (snapshot.customerOrderLines ?? []).some((line) => line.customerOrder === number);
}

/** The next customer order number: one after the highest number in use, 40224 after G1's. */
export function nextCustomerOrderNumber(snapshot: GanttSnapshot): string {
  const numbers = (snapshot.customerOrderLines ?? [])
    .map((line) => Number(line.customerOrder))
    .filter((number) => Number.isInteger(number));
  return String(numbers.length === 0 ? 1 : Math.max(...numbers) + 1);
}

/** What an order makes beyond the customer order lines it supplies, in pieces. */
export function freeQuantityOf(snapshot: GanttSnapshot, order: GanttOrder): number {
  const supplied = (snapshot.customerOrderLines ?? [])
    .filter((line) => line.productionOrderId === order.id)
    .reduce((sum, line) => sum + line.quantity, 0);
  return Math.max(0, order.quantity - supplied);
}

/** The open orders of an article with at least this much free, as a line's supply choices. */
export function ordersWithFree(
  snapshot: GanttSnapshot,
  article: string,
  quantity: number,
): readonly { readonly order: GanttOrder; readonly free: number }[] {
  return snapshot.productionOrders
    .filter((order) => order.article === article)
    .map((order) => ({ order, free: freeQuantityOf(snapshot, order) }))
    .filter(({ free }) => free > 0 && free >= quantity);
}

/** The customer order lines of an article that no production order supplies yet. */
export function linesNeedingSupply(
  snapshot: GanttSnapshot,
  article: string,
): readonly CustomerOrderLine[] {
  return (snapshot.customerOrderLines ?? []).filter(
    (line) => line.article === article && line.productionOrderId === undefined,
  );
}
