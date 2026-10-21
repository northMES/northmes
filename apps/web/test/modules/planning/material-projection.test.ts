// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime } from '@northmes/contracts/format';
import { describe, expect, it } from 'vitest';
import { g1InventorySnapshot } from '../../../src/modules/planning/inventory-data-g1.ts';
import {
  materialShortages,
  projectionOf,
  stockRows,
} from '../../../src/modules/planning/material-projection.ts';

const snapshot = g1InventorySnapshot();
const at = (ms: number) => formatPlantDateTime(ms, snapshot.plant.timeZone);

describe('the projected balance of an article (plan 07, Material warnings; design #729)', () => {
  it('#729 SA1 counts the overdue purchase at now, sorts incoming first, and falls to −26 m when 1004.10 consumes', () => {
    const projection = projectionOf(snapshot, '30-2011');

    expect(projection.start).toBe(92);
    expect(
      projection.steps.map((step) => [
        at(step.movement.atMs),
        step.movement.reference,
        step.movement.quantity,
        step.balance,
      ]),
    ).toEqual([
      ['Mon 2 Nov 09:40', 'Purchase order 7712', 20, 112],
      ['Tue 3 Nov 00:00', 'Transfer 5520', 30, 142],
      ['Tue 3 Nov 00:00', 'Transfer 5520', -30, 112],
      ['Wed 4 Nov 08:00', '1003.10', -36, 76],
      ['Thu 5 Nov 06:00', '1004.10', -102, -26],
      ['Fri 6 Nov 00:00', 'Purchase requisition 3301', 60, undefined],
      ['Mon 9 Nov 00:00', 'Purchase order 7740', 120, 94],
    ]);
    expect(projection.lowest.balance).toBe(-26);
    expect(at(projection.lowest.atMs)).toBe('Thu 5 Nov 06:00');
  });

  it('#729 SA3 takes the output of Bracket L at the end of the last operation and the customer demand at the wanted date', () => {
    const projection = projectionOf(snapshot, '20-1001');

    expect(
      projection.steps.map((step) => [step.movement.kind, step.movement.quantity, step.balance]),
    ).toEqual([
      ['output', 600, 640],
      ['customerDemand', -400, 240],
      ['customerDemand', -200, 40],
      ['output', 600, 640],
      ['customerDemand', -300, 340],
    ]);
    expect(projection.lowest.balance).toBe(40);
  });

  it('#729 ST1 lists the articles with stock at the plant, materials first, by lowest projected balance', () => {
    const rows = stockRows(snapshot);

    expect(
      rows.map((row) => [row.article.number, row.inStock, row.lowest.balance, row.short?.kind]),
    ).toEqual([
      ['30-2011', 92, -26, 'material'],
      ['30-2030', 70, 7, undefined],
      ['30-2020', 180, 36, undefined],
      ['30-2014', 210, 156, undefined],
      ['20-1003', 0, -600, 'lateOrder'],
      ['20-1001', 40, 40, undefined],
      ['20-1004', 120, 120, undefined],
    ]);
    expect(rows[0]?.nextIncoming?.quantity).toBe(120);
    expect(rows[4]?.nextIncoming?.reference).toBe('1003');
  });

  it('#729 MW1 marks only the consuming job order 1004.10 material short, with what causes it', () => {
    const shortages = materialShortages(snapshot);

    expect(shortages.map((each) => each.jobOrder.displayNumber)).toEqual(['1004.10']);
    const [shortage] = shortages;
    expect(shortage?.material.number).toBe('30-2011');
    expect([shortage?.need, shortage?.before, shortage?.after, shortage?.shortfall]).toEqual([
      102, 76, -26, 26,
    ]);
    expect(shortage?.warehouse.code).toBe('A-RM');
    expect(shortage?.nextIncoming?.reference).toBe('Purchase order 7740');
  });
});
