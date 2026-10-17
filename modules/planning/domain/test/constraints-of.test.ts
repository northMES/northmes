// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { constraintsOf, g1PlanContext, type PlanContext, type PlanOrder } from '../src/index.ts';

const context = g1PlanContext();

function orderOf(number: string, from: PlanContext = context): PlanOrder {
  const found = from.orders.find((each) => each.number === number);
  if (found === undefined) throw new Error(`no order ${number}`);
  return found;
}

function withOrder(order: PlanOrder, from: PlanContext = context): PlanContext {
  return { ...from, orders: from.orders.map((each) => (each.id === order.id ? order : each)) };
}

function rowOf(order: PlanOrder, displayNumber: string) {
  const row = order.jobOrders.find((each) => each.displayNumber === displayNumber);
  if (row === undefined) throw new Error(`no row ${displayNumber}`);
  return row;
}

const thu = (hour: number, minute = 0, second = 0) => Date.UTC(2026, 10, 5, hour, minute, second);
const fri = (hour: number, minute = 0, second = 0) => Date.UTC(2026, 10, 6, hour, minute, second);

describe('constraintsOf (plan 18, The constraint list of a row)', () => {
  it('GT4 lists deadline, release, last piece, allowed machines, one job at a time and calendar for 1004.20, each holding', () => {
    const order = orderOf('1004');
    const lines = constraintsOf(order, rowOf(order, '1004.20'), context);

    expect(lines.map((line) => line.kind)).toEqual([
      'deadline',
      'release',
      'lastPiece',
      'allowedMachines',
      'oneJobAtATime',
      'calendar',
    ]);
    expect(lines.every((line) => line.holds)).toBe(true);
    expect(lines[0]).toEqual({
      kind: 'deadline',
      holds: true,
      atMs: fri(14),
      slackElapsedS: 22_480,
    });
    expect(lines[1]).toEqual({
      kind: 'release',
      holds: true,
      fromRow: '1004.10',
      fromJobOrderId: 'jo-1004-10',
      pointMs: thu(8, 15),
      atMs: thu(8, 45),
      leadTimeS: 1800,
      sendAheadQuantity: 300,
    });
    expect(lines[2]).toEqual({
      kind: 'lastPiece',
      holds: true,
      fromRow: '1004.10',
      fromJobOrderId: 'jo-1004-10',
      atMs: fri(7, 45, 20),
    });
    expect(lines[3]).toEqual({ kind: 'allowedMachines', holds: true, equipment: ['MILL1'] });
    expect(lines[4]).toEqual({
      kind: 'oneJobAtATime',
      holds: true,
      equipment: 'MILL1',
      next: { row: '1006.10', setupStartMs: fri(12) },
    });
    expect(lines[5]).toEqual({ kind: 'calendar', holds: true, calendar: 'A1' });
  });

  it('with a split predecessor and a send-ahead, the release names the row that completes the quantity and the last piece the latest-ending row', () => {
    // 1004.10 split: 600 on CNC1 from Thu 06:00 (ends 12:15, completes the 300 first) and 600 on
    // CNC2 from Thu 08:45 (ends 14:15, the latest end); 1004.20 keeps its place.
    const order = orderOf('1004');
    const turn = rowOf(order, '1004.10');
    const split: PlanOrder = {
      ...order,
      jobOrders: [
        {
          ...turn,
          id: 'jo-1004-10a',
          quantity: 600,
          plannedRunS: 18_000,
          placement: { setupStartMs: thu(5), runStartMs: thu(5, 30), endMs: thu(11, 15) },
        },
        {
          ...turn,
          id: 'jo-1004-10b',
          quantity: 600,
          plannedRunS: 18_000,
          equipment: 'CNC2',
          placement: { setupStartMs: thu(7, 45), runStartMs: thu(8, 15), endMs: thu(13, 15) },
        },
        rowOf(order, '1004.20'),
      ],
    };
    const lines = constraintsOf(split, rowOf(split, '1004.20'), withOrder(split));

    expect(lines.find((line) => line.kind === 'release')).toMatchObject({
      fromRow: '1004.10',
      fromJobOrderId: 'jo-1004-10a',
      pointMs: thu(8, 15),
    });
    // The latest end Thu 14:15 plus 30 min of lead plus one 20 s cycle; 1004.20 ends Friday, so it holds.
    expect(lines.find((line) => line.kind === 'lastPiece')).toEqual({
      kind: 'lastPiece',
      holds: true,
      fromRow: '1004.10',
      fromJobOrderId: 'jo-1004-10b',
      atMs: thu(13, 45, 20),
    });
  });

  it('a row dropped before its release names LEAD_TIME with the instant that clears it, on the hover summary too', () => {
    const order = orderOf('1003');
    const early: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) =>
        row.displayNumber === '1003.20'
          ? {
              ...row,
              placement: {
                setupStartMs: Date.UTC(2026, 10, 4, 10, 30),
                runStartMs: Date.UTC(2026, 10, 4, 10, 30),
                endMs: Date.UTC(2026, 10, 5, 5),
              },
            }
          : row,
      ),
    };
    const lines = constraintsOf(early, rowOf(early, '1003.20'), withOrder(early));

    expect(lines.find((line) => line.kind === 'release')).toEqual({
      kind: 'release',
      holds: false,
      code: 'LEAD_TIME',
      involves: ['1003.10'],
      fromRow: '1003.10',
      fromJobOrderId: 'jo-1003-10',
      pointMs: Date.UTC(2026, 10, 4, 11, 45),
      atMs: Date.UTC(2026, 10, 4, 11, 45),
      leadTimeS: 0,
      sendAheadQuantity: 0,
      beforeByS: 4500,
    });
    // 1003 is late, so its deadline line is broken too, as a warning without a code; the
    // last-piece bound of 15 s still holds.
    expect(lines.filter((line) => !line.holds).map((line) => [line.kind, line.code])).toEqual([
      ['deadline', undefined],
      ['release', 'LEAD_TIME'],
    ]);
  });

  it('a row of a locked operation names hardLock, and a started row names started', () => {
    const order = orderOf('1002');
    const lines = constraintsOf(order, rowOf(order, '1002.10'), context);

    expect(lines.map((line) => line.kind)).toEqual([
      'deadline',
      'hardLock',
      'allowedMachines',
      'oneJobAtATime',
      'calendar',
    ]);
    expect(lines[1]).toEqual({ kind: 'hardLock', holds: true });

    const started: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) => ({
        ...row,
        status: 'started' as const,
        actualStartMs: thu(10, 30),
      })),
    };
    expect(
      constraintsOf(started, rowOf(started, '1002.10'), withOrder(started)).map(
        (line) => line.kind,
      ),
    ).toContain('started');
  });

  it('with earliestStartEnabled, an earliest start after the row start names EARLIEST_START', () => {
    const order = { ...orderOf('1001'), earliestStartMs: Date.UTC(2026, 10, 4, 5) };
    const enabled: PlanContext = {
      ...withOrder(order),
      settings: { ...context.settings, earliestStartEnabled: true },
    };

    expect(constraintsOf(order, rowOf(order, '1001.10'), enabled)[1]).toEqual({
      kind: 'earliestStart',
      holds: false,
      code: 'EARLIEST_START',
      involves: ['1001'],
      atMs: Date.UTC(2026, 10, 4, 5),
    });
    expect(
      constraintsOf(order, rowOf(order, '1001.10'), withOrder(order)).map((line) => line.kind),
    ).not.toContain('earliestStart');
  });

  it('GT6 an overlap on the machine breaks one job at a time on both rows, as OVERLAP', () => {
    const rates = {
      cycleSeconds: 60,
      piecesPerCycle: 1,
      cyclesPerPiece: 1,
      planningFactor: 1,
      retoolSeconds: 0,
      fixedSeconds: 0,
    };
    const extra: PlanOrder = {
      id: 'po-1007',
      number: '1007',
      deadlineMs: fri(14),
      priority: null,
      operations: [
        {
          id: '1007.10',
          displayNumber: '1007.10',
          sequence: 10,
          quantity: 60,
          rates,
          leadTimeS: 0,
          sendAheadQuantity: 0,
          isLocked: false,
          allowedEquipment: ['CNC2'],
        },
      ],
      jobOrders: [
        {
          id: 'jo-1007-10',
          operationId: '1007.10',
          displayNumber: '1007.10',
          equipment: 'CNC2',
          quantity: 60,
          status: 'planned',
          placement: { setupStartMs: thu(11), runStartMs: thu(11), endMs: thu(12) },
          plannedSetupS: 0,
          plannedRunS: 3600,
          rates,
        },
      ],
    };
    const ctx = { ...context, orders: [...context.orders, extra] };

    expect(
      constraintsOf(extra, rowOf(extra, '1007.10'), ctx).find(
        (line) => line.kind === 'oneJobAtATime',
      ),
    ).toEqual({
      kind: 'oneJobAtATime',
      holds: false,
      code: 'OVERLAP',
      involves: ['1002.10'],
      equipment: 'CNC2',
      overlaps: '1002.10',
    });
    expect(
      constraintsOf(orderOf('1002'), rowOf(orderOf('1002'), '1002.10'), ctx).find(
        (line) => line.kind === 'oneJobAtATime',
      ),
    ).toMatchObject({
      holds: false,
      code: 'OVERLAP',
      overlaps: '1007.10',
    });
  });

  it('a row inside the frozen window, on a machine it may not use, or on non-plannable equipment says so', () => {
    const order = orderOf('1006');
    const changed: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) => ({
        ...row,
        equipment: 'CNC1',
        placement: {
          setupStartMs: context.nowMs,
          runStartMs: context.nowMs,
          endMs: Date.UTC(2026, 10, 2, 12),
        },
      })),
    };
    const ctx: PlanContext = {
      ...withOrder(changed),
      equipment: { ...context.equipment, CNC1: { isPlannable: false, calendar: 'A1' } },
    };
    const lines = constraintsOf(changed, rowOf(changed, '1006.10'), ctx);

    expect(lines.map((line) => line.kind)).toEqual([
      'deadline',
      'frozenWindow',
      'allowedMachines',
      'oneJobAtATime',
      'calendar',
      'notPlannable',
    ]);
    expect(lines[1]).toEqual({ kind: 'frozenWindow', holds: true, atMs: context.fenceMs });
    expect(lines[2]).toEqual({
      kind: 'allowedMachines',
      holds: false,
      code: 'MACHINE_NOT_ALLOWED',
      equipment: ['MILL1'],
      involves: [],
    });
    expect(lines[5]).toEqual({ kind: 'notPlannable', holds: true, equipment: 'CNC1' });
  });

  it('a committed row with work in closed time breaks calendar as CLOSED_TIME', () => {
    const order = orderOf('1006');
    const closed: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) => ({
        ...row,
        placement: { setupStartMs: fri(12), runStartMs: fri(12), endMs: fri(15) },
      })),
    };

    expect(
      constraintsOf(closed, rowOf(closed, '1006.10'), withOrder(closed)).find(
        (line) => line.kind === 'calendar',
      ),
    ).toEqual({
      kind: 'calendar',
      holds: false,
      code: 'CLOSED_TIME',
      involves: [],
      calendar: 'A1',
      closedS: 3600,
    });
  });
});
