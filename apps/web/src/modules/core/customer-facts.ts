// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Customer, CustomerLine, CustomersSnapshot } from './customers-data.ts';

/** What the customers list and a customer's page say of a customer's open lines (CU1, CC1). */
export interface CustomerSummary {
  readonly customer: Customer;
  readonly lines: number;
  /** The numbers of the production orders that supply its lines, each once, in line order. */
  readonly orders: readonly string[];
  /** The lines whose supplying order is late. */
  readonly late: number;
  /** The lines that no production order supplies. */
  readonly notSupplied: number;
  /** The earliest wanted date of its lines, a plant date; none without lines. */
  readonly nextWanted?: string;
}

/** The open lines of a customer, in the snapshot's order. */
export function linesOf(snapshot: CustomersSnapshot, code: string): CustomerLine[] {
  return snapshot.lines.filter((line) => line.customerCode === code);
}

/** Whether the order that supplies a line is late: the customer orders list's rule (F0, #728). */
export function isLateLine(line: CustomerLine): boolean {
  return line.supply?.late === true;
}

export function summaryOf(snapshot: CustomersSnapshot, customer: Customer): CustomerSummary {
  const lines = linesOf(snapshot, customer.code);
  const wanted = lines.map((line) => line.wantedDate).sort();
  return {
    customer,
    lines: lines.length,
    orders: [
      ...new Set(lines.flatMap((line) => (line.supply === undefined ? [] : [line.supply.number]))),
    ],
    late: lines.filter(isLateLine).length,
    notSupplied: lines.filter((line) => line.supply === undefined).length,
    ...(wanted[0] !== undefined && { nextWanted: wanted[0] }),
  };
}

/** The summary of each customer, in the snapshot's order. */
export function customerSummaries(snapshot: CustomersSnapshot): CustomerSummary[] {
  return snapshot.customers.map((customer) => summaryOf(snapshot, customer));
}

/** "1 order" or "2 orders". */
export function ordersText(count: number): string {
  return count === 1 ? '1 order' : `${count} orders`;
}

/** "1 line" or "3 lines". */
export function linesText(count: number): string {
  return count === 1 ? '1 line' : `${count} lines`;
}
