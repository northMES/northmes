// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { customerSummaries } from '../../../src/modules/core/customer-facts.ts';
import { g1CustomersSnapshot } from '../../../src/modules/core/customers-data-g1.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { lineListRows } from '../../../src/modules/planning/order-list-rows.ts';

describe('the customers of the fixture G1 (design #728)', () => {
  it('#728 holds the four customers from the ERP and their seven open lines', () => {
    const snapshot = g1CustomersSnapshot();
    expect(snapshot.customers.map((customer) => [customer.code, customer.owner])).toEqual([
      ['K-1042', 'erp'],
      ['K-1107', 'erp'],
      ['K-1211', 'erp'],
      ['K-1318', 'erp'],
    ]);
    expect(snapshot.lines).toHaveLength(7);
    expect(snapshot.erp?.name).toBe('Pyramid');
  });

  it('#728 says of each supplied line what the customer orders list says of it: its order, status and lateness', () => {
    const customers = g1CustomersSnapshot();
    const planning = lineListRows(g1Snapshot());
    for (const row of planning) {
      const line = customers.lines.find((each) => each.id === row.line.id);
      expect(line, row.line.id).toBeDefined();
      expect(line?.supply?.number, row.line.id).toBe(row.order?.number);
      expect(line?.supply?.status, row.line.id).toBe(row.order?.status);
      expect(line?.supply?.late ?? false, row.line.id).toBe(row.analysis?.late ?? false);
      expect(line?.supply?.slackElapsedS, row.line.id).toBe(row.analysis?.slackElapsedS);
      expect(line?.supply?.plannedEndMs, row.line.id).toBe(row.analysis?.plannedEndMs);
    }
  });

  it('#728 counts the open lines, supplying orders, late and unsupplied lines and the next wanted date of each customer', () => {
    const summaries = customerSummaries(g1CustomersSnapshot());
    expect(
      summaries.map((summary) => [
        summary.customer.code,
        summary.lines,
        summary.orders,
        summary.late,
        summary.notSupplied,
        summary.nextWanted,
      ]),
    ).toEqual([
      ['K-1042', 3, ['1001', '1005'], 0, 1, '2026-11-06'],
      ['K-1107', 1, ['1001'], 0, 0, '2026-11-09'],
      ['K-1211', 2, ['1002', '1006'], 0, 0, '2026-11-05'],
      ['K-1318', 1, ['1003'], 1, 0, '2026-11-04'],
    ]);
  });
});
