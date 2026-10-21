// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Orders entered by hand on mock data (#768): the production orders and customer orders a planner
// creates with New production order and New customer order, and which order supplies which
// customer order line. They have source NorthMES, so every field stays theirs. The G1 source adds
// them to its plan; the planning server's commands replace them (planning.createProductionOrder,
// planning.setProductionOrderDemand, and a customer order command the plan does not have yet).

/** A production order entered by hand, as New production order saves it. */
export interface EnteredProductionOrder {
  /** Its number in NorthMES's own series, such as N-1007. */
  readonly number: string;
  readonly article: string;
  readonly quantity: number;
  /** The deadline as a plant date, "2026-11-20". */
  readonly deadlineDate: string;
  /** The deadline's plant time, "15:00"; without one the plant's deadline rule sets it. */
  readonly deadlineTime?: string;
  readonly priority: number | null;
  /** A palette token name, such as palette-8. */
  readonly color: string;
  readonly note?: string;
  /** The ids of the customer order lines it supplies, such as 40211-2. */
  readonly suppliedLines: readonly string[];
  readonly createdAtMs: number;
  readonly createdBy: string;
}

/** One line of a customer order entered by hand, with the order that supplies it. */
export interface EnteredCustomerOrderLine {
  readonly line: number;
  readonly article: string;
  readonly quantity: number;
  /** The wanted date as a plant date. */
  readonly wantedDate: string;
  /** The number of the production order that supplies the line; null while none does. */
  readonly supply: string | null;
}

/** A customer order entered by hand, as New customer order saves it. */
export interface EnteredCustomerOrder {
  readonly number: string;
  readonly customerCode: string;
  /** The customer's own order number; empty when the customer gave none. */
  readonly customersReference: string;
  readonly lines: readonly EnteredCustomerOrderLine[];
  readonly createdAtMs: number;
  readonly createdBy: string;
}

/** What has been entered by hand, in the order it was entered. */
export interface EnteredOrders {
  readonly productionOrders: readonly EnteredProductionOrder[];
  readonly customerOrders: readonly EnteredCustomerOrder[];
}

export const noEnteredOrders: EnteredOrders = { productionOrders: [], customerOrders: [] };

/** The first number of NorthMES's own series: one after the fixture's last order, 1006. */
const firstNumber = 1007;

/** The next number of NorthMES's own series, N-1007 first (Krister's working answer, 2026-10-21). */
export function nextProductionOrderNumber(entered: EnteredOrders): string {
  const used = entered.productionOrders
    .map((order) => /^N-(\d+)$/.exec(order.number)?.[1])
    .filter((digits): digits is string => digits !== undefined)
    .map(Number);
  return `N-${used.length === 0 ? firstNumber : Math.max(firstNumber - 1, ...used) + 1}`;
}

/**
 * Which production order supplies each customer order line, by line id: what a production order
 * entered by hand supplies, and what a customer order entered by hand names, the later entry
 * winning.
 */
export function suppliesOf(entered: EnteredOrders): ReadonlyMap<string, string> {
  const supplies = new Map<string, string>();
  for (const order of entered.customerOrders) {
    for (const line of order.lines) {
      if (line.supply !== null) supplies.set(`${order.number}-${line.line}`, line.supply);
    }
  }
  for (const order of entered.productionOrders) {
    for (const line of order.suppliedLines) supplies.set(line, order.number);
  }
  return supplies;
}
