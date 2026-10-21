// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

import { g1, g1Pages } from '@northmes/planning-domain';
import { describe, expect, it } from 'vitest';
import { enteredAt } from '../../../src/modules/planning/entered-orders.ts';
import { createEnteredOrdersStore } from '../../../src/modules/planning/entered-orders-store.ts';
import { g1Snapshot, g1Week } from '../../../src/modules/planning/gantt-data-g1.ts';

const created = { createdAtMs: Date.parse('2026-11-02T08:45:00Z'), createdBy: 'Alex Lund' };

describe('orders entered by hand on mock data (#768)', () => {
  it('numbers them in their own series after the fixture, N-1007 first', () => {
    const store = createEnteredOrdersStore();
    expect(store.nextProductionOrderNumber()).toBe('N-1007');
    store.addProductionOrder({
      plant: 'plant-a',
      number: 'N-1007',
      article: 'Hub 12',
      quantity: 250,
      deadlineDate: '2026-11-20',
      priority: null,
      color: 'palette-8',
      suppliedLines: [],
      ...created,
    });
    expect(store.nextProductionOrderNumber()).toBe('N-1008');
  });

  it('keeps each order with the plant it was entered at', () => {
    const store = createEnteredOrdersStore();
    store.addProductionOrder({
      plant: 'plant-a',
      number: 'N-1007',
      article: 'Hub 12',
      quantity: 250,
      deadlineDate: '2026-11-20',
      priority: null,
      color: 'palette-8',
      suppliedLines: [],
      ...created,
    });
    expect(enteredAt(store.get(), 'plant-a').productionOrders).toHaveLength(1);
    expect(enteredAt(store.get(), 'plant-b').productionOrders).toEqual([]);
  });

  it('adds a production order, released, with an unplaced job order per routing operation, and the line it supplies', () => {
    const store = createEnteredOrdersStore();
    store.addProductionOrder({
      plant: 'plant-a',
      number: 'N-1007',
      article: 'Hub 12',
      quantity: 250,
      deadlineDate: '2026-11-20',
      priority: null,
      color: 'palette-8',
      suppliedLines: ['40211-2'],
      ...created,
    });
    const snapshot = g1Snapshot(g1, g1Week, g1Pages, undefined, store.get());

    const order = snapshot.productionOrders.find((each) => each.number === 'N-1007');
    expect(order).toMatchObject({
      id: 'po-N-1007',
      article: 'Hub 12',
      quantity: 250,
      status: 'released',
      owner: 'northmes',
      origin: { createdBy: 'Alex Lund', routingVersion: 1 },
    });
    expect(order?.operations.map((operation) => [operation.displayNumber, operation.name])).toEqual(
      [
        ['N-1007.10', 'Turn'],
        ['N-1007.20', 'Mill'],
      ],
    );
    // Hub 12's Turn runs 30 s a piece with 1 800 s retool, as on order 1004.
    expect(order?.jobOrders[0]).toMatchObject({
      displayNumber: 'N-1007.10',
      plannedSetupS: 1800,
      plannedRunS: 7500,
    });
    expect(order?.jobOrders.every((row) => row.placement === undefined)).toBe(true);
    expect(
      snapshot.customerOrderLines?.find((line) => line.id === '40211-2')?.productionOrderId,
    ).toBe('po-N-1007');
  });

  it('adds a customer order with its lines, one of them supplied by an open order with quantity free', () => {
    const store = createEnteredOrdersStore();
    store.addCustomerOrder({
      plant: 'plant-a',
      number: '40231',
      customerCode: 'K-1211',
      customersReference: 'LM-2026-140',
      lines: [
        { line: 1, article: 'Hub 12', quantity: 100, wantedDate: '2026-11-27', supply: '1004' },
        { line: 2, article: 'Shaft 8', quantity: 200, wantedDate: '2026-11-25', supply: null },
      ],
      ...created,
    });
    const snapshot = g1Snapshot(g1, g1Week, g1Pages, undefined, store.get());

    const lines = snapshot.customerOrderLines?.filter((line) => line.customerOrder === '40231');
    expect(lines?.map((line) => [line.id, line.article, line.productionOrderId])).toEqual([
      ['40231-1', 'Hub 12', 'po-1004'],
      ['40231-2', 'Shaft 8', undefined],
    ]);
    expect(lines?.[0]).toMatchObject({ customerCode: 'K-1211', customersReference: 'LM-2026-140' });
  });
});
