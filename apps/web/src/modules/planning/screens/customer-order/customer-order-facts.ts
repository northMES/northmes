// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { CustomerOrderLine, GanttOrder, GanttSnapshot } from '../../gantt-data.ts';
import { demandOf } from '../../order-facts.ts';

/** The lines of a customer order, by line number. */
export function linesOfCustomerOrder(snapshot: GanttSnapshot, number: string): CustomerOrderLine[] {
  return (snapshot.customerOrderLines ?? [])
    .filter((line) => line.customerOrder === number)
    .sort((a, b) => a.line - b.line);
}

/** What an order supplies beside a line: each line it supplies, then what is left to stock (KO1). */
export interface OrderShare {
  readonly quantity: number;
  readonly text: string;
}

/** The quantity of an order its customer order lines take. */
function demandQuantity(snapshot: GanttSnapshot, order: GanttOrder): number {
  return demandOf(snapshot, order).reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Everything an order supplies, as the row under a supplied line says it (KO1): this line, each
 * other line with its customer order and customer, and the rest to stock.
 */
export function sharesOf(
  snapshot: GanttSnapshot,
  order: GanttOrder,
  line: CustomerOrderLine,
): OrderShare[] {
  const names = new Map((snapshot.customers ?? []).map((each) => [each.code, each.name]));
  const shares = demandOf(snapshot, order).map((each) => ({
    quantity: each.quantity,
    text:
      each.id === line.id
        ? 'this line'
        : `customer order ${each.customerOrder} line ${each.line}, ${names.get(each.customerCode) ?? each.customerCode}`,
  }));
  const used = demandQuantity(snapshot, order);
  return used < order.quantity
    ? [...shares, { quantity: order.quantity - used, text: 'stock' }]
    : shares;
}

/** An order a line can be supplied from (KO3): its free quantity, and whether it is a stock order. */
export interface SupplyCandidate {
  readonly order: GanttOrder;
  readonly free: number;
  /** Whether no customer order line takes any of it yet. */
  readonly stock: boolean;
}

/** The orders of the line's article with quantity free, by deadline (KO3). */
export function supplyCandidates(
  snapshot: GanttSnapshot,
  line: CustomerOrderLine,
): SupplyCandidate[] {
  return snapshot.productionOrders
    .filter((order) => order.article === line.article)
    .map((order) => {
      const used = demandQuantity(snapshot, order);
      return { order, free: order.quantity - used, stock: used === 0 };
    })
    .filter((candidate) => candidate.free > 0)
    .sort((a, b) => a.order.deadlineMs - b.order.deadlineMs);
}
