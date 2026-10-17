// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cascade, g1PlanContext, type PlanContext, type PlanOrder } from '../src/index.ts';

const context = g1PlanContext();

function orderOf(number: string, from: PlanContext = context): PlanOrder {
  const found = from.orders.find((each) => each.number === number);
  if (found === undefined) throw new Error(`no order ${number}`);
  return found;
}

function withOrder(order: PlanOrder, from: PlanContext = context): PlanContext {
  return { ...from, orders: from.orders.map((each) => (each.id === order.id ? order : each)) };
}

/** An order with one row's placement or operation changed. */
function withRow(
  order: PlanOrder,
  displayNumber: string,
  placement: { setupStartMs: number; runStartMs: number; endMs: number },
): PlanOrder {
  return {
    ...order,
    jobOrders: order.jobOrders.map((row) =>
      row.displayNumber === displayNumber ? { ...row, placement } : row,
    ),
  };
}

const wed = (hour: number, minute = 0, second = 0) => Date.UTC(2026, 10, 4, hour, minute, second);
const thu = (hour: number, minute = 0, second = 0) => Date.UTC(2026, 10, 5, hour, minute, second);
const fri = (hour: number, minute = 0, second = 0) => Date.UTC(2026, 10, 6, hour, minute, second);

describe('cascade (plan 18, Cascade)', () => {
  it('GT3 with cascade on, moving 1003.10 to Wed 09:00 moves 1003.20 to Wed 13:30, ending Thu 07:00, and the order is late by 57 600 s', () => {
    const result = cascade(
      orderOf('1003'),
      { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) },
      context,
    );

    expect(result.refused).toBeUndefined();
    expect(result.stop).toBeUndefined();
    expect(result.conflicts).toEqual([]);
    expect(result.moves).toEqual([
      {
        jobOrderId: 'jo-1003-10',
        displayNumber: '1003.10',
        equipment: 'CNC1',
        from: { setupStartMs: wed(7), runStartMs: wed(7), endMs: wed(11, 45) },
        to: { setupStartMs: wed(8), runStartMs: wed(8), endMs: wed(12, 30) },
        reason: 'moved',
      },
      {
        jobOrderId: 'jo-1003-20',
        displayNumber: '1003.20',
        equipment: 'MILL1',
        from: { setupStartMs: wed(11, 45), runStartMs: wed(11, 45), endMs: thu(5, 15) },
        to: { setupStartMs: wed(12, 30), runStartMs: wed(12, 30), endMs: thu(6) },
        reason: 'cascade',
      },
    ]);
    expect(result.order.deadlineMs - thu(6)).toBe(-57_600 * 1000);
  });

  it('GT3 with cascade off, the move is written alone and LEAD_TIME is reported on both rows, clearing at Wed 13:30', () => {
    const result = cascade(
      orderOf('1003'),
      { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) },
      context,
      { cascade: false },
    );

    expect(result.moves.map((move) => move.displayNumber)).toEqual(['1003.10']);
    expect(result.conflicts).toEqual([
      { kind: 'LEAD_TIME', rows: ['1003.10', '1003.20'], clearsAtMs: wed(12, 30) },
    ]);
  });

  it('GT4 the last-piece bound places 1004.20 at Thu 10:20:20 to Fri 08:45:20, and no conflict remains', () => {
    // 1004.20 laid forward from its release Thu 09:45 ends Fri 07:55, before 1004.10's end plus
    // lead plus one cycle; a cascade from 1004.10 at its own start moves it right until the bound holds.
    const early = withRow(orderOf('1004'), '1004.20', {
      setupStartMs: thu(8, 45),
      runStartMs: thu(8, 45),
      endMs: fri(6, 55),
    });
    const result = cascade(
      early,
      { jobOrderId: 'jo-1004-10', setupStartMs: thu(5) },
      withOrder(early),
    );

    expect(result.conflicts).toEqual([]);
    expect(
      result.moves.map(({ displayNumber, to, reason }) => ({ displayNumber, to, reason })),
    ).toEqual([
      {
        displayNumber: '1004.10',
        to: { setupStartMs: thu(5), runStartMs: thu(5, 30), endMs: fri(7, 15) },
        reason: 'moved',
      },
      {
        displayNumber: '1004.20',
        to: { setupStartMs: thu(9, 20, 20), runStartMs: thu(9, 20, 20), endMs: fri(7, 45, 20) },
        reason: 'cascade',
      },
    ]);
  });

  it('a hard-locked successor stops the cascade and its broken rule is reported', () => {
    const order = orderOf('1003');
    const locked: PlanOrder = {
      ...order,
      operations: order.operations.map((operation) =>
        operation.displayNumber === '1003.20' ? { ...operation, isLocked: true } : operation,
      ),
    };
    const result = cascade(
      locked,
      { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) },
      withOrder(locked),
    );

    expect(result.moves.map((move) => move.displayNumber)).toEqual(['1003.10']);
    expect(result.stop).toEqual({ row: '1003.20', jobOrderId: 'jo-1003-20', reason: 'hardLock' });
    expect(result.conflicts).toEqual([
      { kind: 'LEAD_TIME', rows: ['1003.10', '1003.20'], clearsAtMs: wed(12, 30) },
    ]);
  });

  it('a successor whose release moved earlier stays where it is; the overlap the move causes is reported', () => {
    const result = cascade(
      orderOf('1003'),
      { jobOrderId: 'jo-1003-10', setupStartMs: wed(5) },
      context,
    );

    expect(result.moves.map(({ displayNumber, to }) => ({ displayNumber, to }))).toEqual([
      {
        displayNumber: '1003.10',
        to: { setupStartMs: wed(5), runStartMs: wed(5), endMs: wed(9, 15) },
      },
    ]);
    expect(result.conflicts).toEqual([{ kind: 'OVERLAP', rows: ['1001.10', '1003.10'] }]);
  });

  it('a drop before the release snaps to the release with cascade on, and keeps the raw position with cascade off', () => {
    const on = cascade(
      orderOf('1003'),
      { jobOrderId: 'jo-1003-20', setupStartMs: wed(10) },
      context,
    );
    expect(on.moves).toEqual([
      expect.objectContaining({
        displayNumber: '1003.20',
        to: { setupStartMs: wed(11, 45), runStartMs: wed(11, 45), endMs: thu(5, 15) },
        reason: 'snappedToRelease',
        snappedTo: { fromRow: '1003.10', atMs: wed(11, 45) },
      }),
    ]);
    expect(on.conflicts).toEqual([]);

    const off = cascade(
      orderOf('1003'),
      { jobOrderId: 'jo-1003-20', setupStartMs: wed(10) },
      context,
      { cascade: false },
    );
    expect(off.moves[0]?.to.setupStartMs).toBe(wed(10, 30));
    expect(off.conflicts).toEqual([
      { kind: 'LEAD_TIME', rows: ['1003.10', '1003.20'], clearsAtMs: wed(11, 45) },
    ]);
  });

  it('a move onto a machine where a successor lies cascades the successor away and reports no overlap', () => {
    // 1001.10 onto CNC2 at Wed 06:00, over 1001.20 as it lies: the cascade moves 1001.20 under its
    // release, so the overlap the drop would have caused is gone and only the moves remain.
    const result = cascade(
      orderOf('1001'),
      { jobOrderId: 'jo-1001-10', setupStartMs: wed(5), equipment: 'CNC2' },
      context,
    );

    expect(result.conflicts).toEqual([]);
    expect(
      result.moves.map(({ displayNumber, equipment, to }) => ({ displayNumber, equipment, to })),
    ).toEqual([
      {
        displayNumber: '1001.10',
        equipment: 'CNC2',
        to: { setupStartMs: wed(5), runStartMs: wed(5, 30), endMs: wed(11, 15) },
      },
      {
        displayNumber: '1001.20',
        equipment: 'CNC2',
        // Under its release Wed 13:15, past the locked 1002.10 on CNC2, so from Fri 06:00.
        to: { setupStartMs: fri(5), runStartMs: fri(5), endMs: Date.UTC(2026, 10, 9, 6, 45) },
      },
    ]);
  });

  it('a drop in closed time snaps forward to the next working instant on the machine', () => {
    const result = cascade(
      orderOf('1006'),
      { jobOrderId: 'jo-1006-10', setupStartMs: fri(16) },
      context,
    );

    expect(result.moves[0]?.to).toEqual({
      setupStartMs: Date.UTC(2026, 10, 9, 5),
      runStartMs: Date.UTC(2026, 10, 9, 5),
      endMs: Date.UTC(2026, 10, 9, 8, 15),
    });
  });

  it('refuses to move a hard-locked, started or held row', () => {
    expect(
      cascade(orderOf('1002'), { jobOrderId: 'jo-1002-10', setupStartMs: thu(5) }, context),
    ).toMatchObject({
      refused: 'PINNED',
      moves: [],
    });
    const order = orderOf('1006');
    const started: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) => ({ ...row, status: 'started' as const })),
    };
    expect(
      cascade(started, { jobOrderId: 'jo-1006-10', setupStartMs: fri(5) }, withOrder(started)),
    ).toMatchObject({
      refused: 'STARTED',
    });
    const held: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) => ({ ...row, held: true })),
    };
    expect(
      cascade(held, { jobOrderId: 'jo-1006-10', setupStartMs: fri(5) }, withOrder(held)),
    ).toMatchObject({
      refused: 'LOCKED',
    });
  });

  it('a move into the frozen window is confirmable: FROZEN_WINDOW is reported and the move stands', () => {
    const result = cascade(
      orderOf('1006'),
      { jobOrderId: 'jo-1006-10', setupStartMs: context.nowMs },
      context,
    );

    expect(result.moves).toHaveLength(1);
    expect(result.conflicts).toEqual([{ kind: 'FROZEN_WINDOW', rows: ['1006.10'] }]);
  });

  it('GT3 is permutation-invariant in the orders, operations and job orders', () => {
    const expected = cascade(
      orderOf('1003'),
      { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) },
      context,
    );
    const shuffle = <T>(items: readonly T[]) =>
      fc.shuffledSubarray([...items], { minLength: items.length });
    fc.assert(
      fc.property(
        shuffle(context.orders).chain((orders) =>
          fc.tuple(
            fc.constant(orders),
            ...orders.map((order) => fc.tuple(shuffle(order.operations), shuffle(order.jobOrders))),
          ),
        ),
        ([orders, ...parts]) => {
          const shuffled = orders.map((order, index) => ({
            ...order,
            operations: parts[index]?.[0] ?? order.operations,
            jobOrders: parts[index]?.[1] ?? order.jobOrders,
          }));
          const permuted = { ...context, orders: shuffled };
          const result = cascade(
            orderOf('1003', permuted),
            { jobOrderId: 'jo-1003-10', setupStartMs: wed(8) },
            permuted,
          );
          expect({ ...result, order: undefined }).toEqual({ ...expected, order: undefined });
        },
      ),
      { numRuns: 25 },
    );
  });
});
