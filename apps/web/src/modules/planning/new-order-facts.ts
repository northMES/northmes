// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// What New production order and New customer order read from the plan (#768): which numbers are
// taken, what an open order still has free for a customer order line, and the lines that need one.
import type { CustomerOrderLine, GanttOrder, GanttSnapshot } from './gantt-data.ts';

/** A quantity in whole pieces as typed, greater than 0; undefined for anything else, 1,000 too. */
export function wholePieces(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,9}$/.test(trimmed)) return undefined;
  const number = Number(trimmed);
  return number > 0 ? number : undefined;
}

/** Whether text is a real plant date, "2026-11-27". */
export function validPlantDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

/**
 * What is wrong with an order number as an address segment, or undefined: letters, digits, - and
 * _ only, up to 32 characters, and not new, which the form's own address takes.
 */
export function orderNumberProblem(number: string): string | undefined {
  if (number.toLowerCase() === 'new') {
    return 'Choose another number: new is a word the address takes.';
  }
  if (!/^[A-Za-z0-9][\w-]{0,31}$/.test(number)) {
    return 'Use letters, digits, - and _ only, up to 32 characters.';
  }
  return undefined;
}

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

/**
 * The open orders of an article with at least this much free, as a line's supply choices; taken
 * holds what the form's other lines already take from each order, by order number.
 */
export function ordersWithFree(
  snapshot: GanttSnapshot,
  article: string,
  quantity: number,
  taken: ReadonlyMap<string, number> = new Map(),
): readonly { readonly order: GanttOrder; readonly free: number }[] {
  return snapshot.productionOrders
    .filter((order) => order.article === article)
    .map((order) => ({
      order,
      free: Math.max(0, freeQuantityOf(snapshot, order) - (taken.get(order.number) ?? 0)),
    }))
    .filter(({ free }) => free > 0 && free >= quantity);
}

/**
 * The customer order lines of an article that no production order supplies yet and that this
 * plant delivers, or that name no delivering plant (plan 07: same-plant or company lines only).
 */
export function linesNeedingSupply(
  snapshot: GanttSnapshot,
  article: string,
): readonly CustomerOrderLine[] {
  return (snapshot.customerOrderLines ?? []).filter(
    (line) =>
      line.article === article &&
      line.productionOrderId === undefined &&
      (line.deliveringPlant === undefined || line.deliveringPlant === snapshot.plant.slug),
  );
}
