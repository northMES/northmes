// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  combineIntoRun,
  g1Expected,
  g1PlanContext,
  type PlanContext,
  type PlanOrder,
  type RunResult,
  releaseOf,
  splitRun,
} from '../src/index.ts';

const context = g1PlanContext();
const gt10 = g1Expected.GT10_run_1001_1005;

function orderOf(number: string, from: PlanContext = context): PlanOrder {
  const found = from.orders.find((each) => each.number === number);
  if (found === undefined) throw new Error(`no order ${number}`);
  return found;
}

const ms = (instant: string) => Date.parse(instant);
const wedUtc = (hour: number, minute = 0) => Date.UTC(2026, 10, 4, hour, minute);

/** The span of a GT10 placement in epoch milliseconds. */
function spanOf(key: string) {
  const placed = gt10.moved[key];
  if (placed === undefined) throw new Error(`no GT10 placement ${key}`);
  return {
    setupStartMs: ms(placed.start.instant),
    runStartMs: ms(placed.runStart.instant),
    endMs: ms(placed.end.instant),
  };
}

function rowOf(result: RunResult, displayNumber: string) {
  const row = result.orders
    .flatMap((order) => order.jobOrders)
    .find((each) => each.displayNumber === displayNumber);
  if (row === undefined) throw new Error(`no row ${displayNumber}`);
  return row;
}

describe('combineIntoRun (ADR 0083, plan 18 Runs)', () => {
  const combined = combineIntoRun([orderOf('1005'), orderOf('1001')], context);

  it('GT10 ranks 1001 first, takes its deadline and flags 1005 early by 7 days', () => {
    expect(combined.refused).toBeUndefined();
    expect(combined.run).toEqual({
      id: 'run:po-1001+po-1005',
      article: 'Bracket L',
      orderIds: ['po-1001', 'po-1005'],
      orderNumbers: gt10.runOrder,
      deadlineMs: ms(gt10.deadline.instant),
      savedSetups: [
        {
          jobOrderId: 'jo-1005-10',
          displayNumber: '1005.10',
          afterJobOrderId: 'jo-1001-10',
          afterDisplayNumber: '1001.10',
          equipment: 'CNC1',
          setupS: 1800,
        },
      ],
      early: [
        {
          orderId: 'po-1005',
          number: '1005',
          deadlineMs: ms('2026-11-13T14:00:00Z'),
          earlyByS: 604_800,
        },
      ],
      before: orderOf('1005').jobOrders.map((row) => ({
        jobOrderId: row.id,
        displayNumber: row.displayNumber,
        equipment: row.equipment,
        placement: row.placement,
        plannedSetupS: row.plannedSetupS,
      })),
    });
    expect(combined.run?.early[0]?.earlyByS).toBe(gt10.early[0]?.earlyByElapsedS);
  });

  it('GT10 lays 1005.10 directly after 1001.10 on CNC1 with no setup, and 1005.20 under its release past 1001.20 and the locked 1002.10 on CNC2', () => {
    const before1005 = orderOf('1005');
    expect(combined.moves).toEqual([
      {
        jobOrderId: 'jo-1005-10',
        displayNumber: '1005.10',
        equipment: 'CNC1',
        from: before1005.jobOrders[0]?.placement,
        to: spanOf('1005.10'),
        reason: 'run',
        setupS: 0,
      },
      {
        jobOrderId: 'jo-1005-20',
        displayNumber: '1005.20',
        equipment: 'CNC2',
        from: before1005.jobOrders[1]?.placement,
        to: spanOf('1005.20'),
        reason: 'cascade',
      },
    ]);
    expect(spanOf('1005.10').setupStartMs).toBe(orderOf('1001').jobOrders[0]?.placement?.endMs);
    expect(rowOf(combined, '1005.10').plannedSetupS).toBe(0);
    expect(rowOf(combined, '1005.20').plannedSetupS).toBe(0);
    const order1005 = combined.orders[1];
    if (order1005 === undefined) throw new Error('no 1005 in the run');
    const release = releaseOf(order1005, '1005.20', { ...context, orders: combined.orders });
    expect(release?.atMs).toBe(ms(gt10.release_1005_20.instant));
  });

  it('GT10 keeps the rows of 1001 where they are', () => {
    expect(combined.orders[0]).toEqual(orderOf('1001'));
  });

  it('GT10 reports the overlap with 1003.10 and the run late by 2 days 16 h 45 min against Fri 6 Nov 15:00', () => {
    expect(combined.conflicts).toEqual([{ kind: 'OVERLAP', rows: ['1003.10', '1005.10'] }]);
    expect(combined.stops).toEqual([]);
    expect(combined.startMs).toBe(ms(gt10.runStart.instant));
    expect(combined.endMs).toBe(ms(gt10.runEnd.instant));
    expect(combined.late).toBe(gt10.late);
    expect(combined.lateByS).toBe(gt10.lateByElapsedS);
  });

  it('refuses one order, orders of different articles, an order without a placed row and an order with a fixed row', () => {
    expect(combineIntoRun([orderOf('1001')], context).refused).toBe('ONE_ORDER');
    expect(combineIntoRun([orderOf('1001'), orderOf('1003')], context).refused).toBe(
      'DIFFERENT_ARTICLES',
    );
    const unplaced: PlanOrder = {
      ...orderOf('1005'),
      jobOrders: orderOf('1005').jobOrders.map((row, index) =>
        index === 1 ? { ...row, equipment: undefined, placement: undefined } : row,
      ),
    };
    expect(combineIntoRun([orderOf('1001'), unplaced], context)).toMatchObject({
      refused: 'UNPLACED',
      refusedBy: '1005',
    });
    const started: PlanOrder = {
      ...orderOf('1001'),
      jobOrders: orderOf('1001').jobOrders.map((row, index) =>
        index === 0 ? { ...row, status: 'started' } : row,
      ),
    };
    expect(combineIntoRun([started, orderOf('1005')], context)).toMatchObject({
      refused: 'FIXED',
      refusedBy: '1001.10',
    });
    const locked: PlanOrder = {
      ...orderOf('1005'),
      operations: orderOf('1005').operations.map((operation, index) =>
        index === 1 ? { ...operation, isLocked: true } : operation,
      ),
    };
    expect(combineIntoRun([orderOf('1001'), locked], context)).toMatchObject({
      refused: 'FIXED',
      refusedBy: '1005.20',
    });
  });

  it('an operation whose first order ran on a machine the later operation does not allow keeps its setup and follows the cascade rules', () => {
    const onlyCnc2: PlanOrder = {
      ...orderOf('1005'),
      operations: orderOf('1005').operations.map((operation, index) =>
        index === 0 ? { ...operation, allowedEquipment: ['CNC2'] } : operation,
      ),
    };
    const result = combineIntoRun([orderOf('1001'), onlyCnc2], context);

    expect(result.run?.savedSetups).toEqual([]);
    expect(rowOf(result, '1005.10').plannedSetupS).toBe(1800);
    // 1005.10 has no predecessor and no setup to save, so it stays where it was.
    expect(result.moves.map((move) => move.displayNumber)).toEqual([]);
  });

  it('a split operation of the later order follows the previous row one row after the other, each without a retool (ADR 0083 rule 3)', () => {
    const [turn, mill] = orderOf('1005').jobOrders;
    if (turn === undefined || mill === undefined) throw new Error('rows of 1005');
    const halves = ['a', 'b'].map((half) => ({
      ...turn,
      id: `${turn.id}-${half}`,
      quantity: 300,
      plannedRunS: 9000,
    }));
    const split: PlanOrder = { ...orderOf('1005'), jobOrders: [...halves, mill] };
    const result = combineIntoRun([split, orderOf('1001')], context);

    expect(result.refused).toBeUndefined();
    expect(
      result.run?.savedSetups.map((saved) => [saved.jobOrderId, saved.afterJobOrderId]),
    ).toEqual([
      ['jo-1005-10-a', 'jo-1001-10'],
      ['jo-1005-10-b', 'jo-1005-10-a'],
    ]);
    // The first half starts where 1001.10 ends, Wed 08:00, and runs 9 000 s across the 08:30 break;
    // the second follows it at Wed 10:45 across the 11:00 break; neither has a retool.
    expect(result.moves.slice(0, 2).map((move) => [move.jobOrderId, move.setupS, move.to])).toEqual(
      [
        [
          'jo-1005-10-a',
          0,
          { setupStartMs: wedUtc(7), runStartMs: wedUtc(7), endMs: wedUtc(9, 45) },
        ],
        [
          'jo-1005-10-b',
          0,
          { setupStartMs: wedUtc(9, 45), runStartMs: wedUtc(9, 45), endMs: wedUtc(12, 45) },
        ],
      ],
    );
    const shuffled = combineIntoRun(
      [orderOf('1001'), { ...split, jobOrders: [mill, ...halves.reverse()] }],
      context,
    );
    expect(shuffled.moves).toEqual(result.moves);
  });

  it('a later row placed under its release inside the frozen window moves and reports FROZEN_WINDOW, as a moved row does in the cascade', () => {
    // With now at Thu 5 Nov 13:00 and the fence 24 h later, 1005.20 lands at Fri 06:00 on CNC2,
    // inside the window; the run keeps the move and reports it (plan 18, GT8; cascade rule 5 fixes
    // only a row that already lies inside the window).
    const frozen: PlanContext = {
      ...context,
      nowMs: Date.UTC(2026, 10, 5, 12),
      fenceMs: Date.UTC(2026, 10, 6, 12),
    };
    const result = combineIntoRun([orderOf('1001'), orderOf('1005')], frozen);

    expect(result.moves.map((move) => move.displayNumber)).toEqual(['1005.10', '1005.20']);
    expect(rowOf(result, '1005.20').placement?.setupStartMs).toBe(Date.UTC(2026, 10, 6, 5));
    expect(result.conflicts).toContainEqual({ kind: 'FROZEN_WINDOW', rows: ['1005.20'] });
  });

  it('a later row that could save its retool but already lies inside the frozen window is fixed: it stays, keeps its retool and the run reports the stop', () => {
    // With now at Mon 9 Nov 05:00 and the fence at 13:00 plant time, the committed 1005.10 (Mon
    // 06:00 to 12:15) lies inside the window and 1005.20 (Mon 13:15) does not. 1005.10 stays with
    // its retool; 1005.20 is already at its release from it, so nothing moves.
    const frozen: PlanContext = {
      ...context,
      nowMs: Date.UTC(2026, 10, 9, 4),
      fenceMs: Date.UTC(2026, 10, 9, 12),
    };
    const result = combineIntoRun([orderOf('1001'), orderOf('1005')], frozen);

    expect(result.moves).toEqual([]);
    expect(result.run?.savedSetups).toEqual([]);
    expect(rowOf(result, '1005.10')).toEqual(orderOf('1005').jobOrders[0]);
    expect(result.stops).toEqual([
      { row: '1005.10', jobOrderId: 'jo-1005-10', reason: 'frozenWindow' },
    ]);
  });

  it('later rows that already lie inside the frozen window are fixed on both paths: they stay and the run reports a stop for each', () => {
    // With now at Mon 9 Nov 00:00 and the fence 24 h later, both committed rows of 1005 (Mon 06:00
    // and 13:15) lie inside the window, so the run moves neither (cascade rule 5).
    const frozen: PlanContext = {
      ...context,
      nowMs: Date.UTC(2026, 10, 8, 23),
      fenceMs: Date.UTC(2026, 10, 9, 23),
    };
    const result = combineIntoRun([orderOf('1001'), orderOf('1005')], frozen);

    expect(result.moves).toEqual([]);
    expect(result.orders[1]).toEqual(orderOf('1005'));
    expect(result.stops).toEqual([
      { row: '1005.10', jobOrderId: 'jo-1005-10', reason: 'frozenWindow' },
      { row: '1005.20', jobOrderId: 'jo-1005-20', reason: 'frozenWindow' },
    ]);
  });

  it('is deterministic and permutation-invariant in the orders, their operations and their rows', () => {
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
          const members = shuffled.filter((order) => ['1001', '1005'].includes(order.number));
          const result = combineIntoRun(members, permuted);
          expect({ ...result, orders: undefined }).toEqual({ ...combined, orders: undefined });
          expect(result.orders.map((order) => order.id)).toEqual(
            combined.orders.map((order) => order.id),
          );
        },
      ),
      { numRuns: 25 },
    );
  });

  it('keeps the invariants of ADR 0083 rule 9 over every pair and triple of placed orders of one article', () => {
    // Every order of G1 made a Bracket L order, so any subset can be combined.
    const sameArticle = context.orders.map((order) => ({ ...order, article: 'Bracket L' }));
    const ctx = { ...context, orders: sameArticle };
    const candidates = sameArticle.filter(
      (order) =>
        !order.operations.some((operation) => operation.isLocked) &&
        order.jobOrders.every((row) => row.status === 'planned'),
    );
    fc.assert(
      fc.property(fc.shuffledSubarray(candidates, { minLength: 2, maxLength: 3 }), (members) => {
        const result = combineIntoRun(members, ctx);
        expect(result.refused).toBeUndefined();
        const run = result.run;
        if (run === undefined) throw new Error('no run');
        expect(run.deadlineMs).toBe(Math.min(...members.map((order) => order.deadlineMs)));
        const first = result.orders[0];
        expect(first).toEqual(members.find((order) => order.id === first?.id));
        const after = {
          ...ctx,
          orders: ctx.orders.map((o) => result.orders.find((r) => r.id === o.id) ?? o),
        };
        for (const order of result.orders.slice(1)) {
          for (const operation of order.operations) {
            const release = releaseOf(order, operation.id, after);
            for (const row of order.jobOrders.filter((each) => each.operationId === operation.id)) {
              expect(operation.allowedEquipment).toContain(row.equipment);
              if (release !== undefined && row.placement !== undefined) {
                expect(row.placement.runStartMs).toBeGreaterThanOrEqual(release.atMs);
              }
            }
          }
        }
        for (const saved of run.savedSetups) {
          const row = after.orders
            .flatMap((o) => o.jobOrders)
            .find((r) => r.id === saved.jobOrderId);
          const followed = after.orders
            .flatMap((o) => o.jobOrders)
            .find((r) => r.id === saved.afterJobOrderId);
          expect(row?.plannedSetupS).toBe(0);
          expect(row?.equipment).toBe(followed?.equipment);
          expect(row?.placement?.setupStartMs).toBeGreaterThanOrEqual(
            followed?.placement?.endMs ?? 0,
          );
        }
      }),
      { numRuns: 40 },
    );
  });
});

describe('splitRun (ADR 0083 rule 7)', () => {
  const combined = combineIntoRun([orderOf('1001'), orderOf('1005')], context);

  it('GT10 puts both rows of 1005 back to their week 46 placements, the 30 min retool of 1005.10 with them', () => {
    const run = combined.run;
    if (run === undefined) throw new Error('no run');
    const split = splitRun(run, combined.orders);

    const back = (key: string) => {
      const expected = gt10.split[key];
      if (typeof expected !== 'object') throw new Error(`GT10 split of ${key}`);
      return {
        equipment: expected.equipment,
        to: {
          setupStartMs: ms(expected.start.instant),
          runStartMs: ms(expected.runStart.instant),
          endMs: ms(expected.end.instant),
        },
      };
    };
    expect(split.moves).toEqual([
      {
        jobOrderId: 'jo-1005-10',
        displayNumber: '1005.10',
        from: spanOf('1005.10'),
        reason: 'moved',
        setupS: 1800,
        ...back('1005.10'),
      },
      {
        jobOrderId: 'jo-1005-20',
        displayNumber: '1005.20',
        from: spanOf('1005.20'),
        reason: 'moved',
        ...back('1005.20'),
      },
    ]);
    expect(split.orders).toEqual([orderOf('1001'), orderOf('1005')]);
  });

  it('GT10 with a fixed time on 1005.10 the run saves the retool alone and the split gives the whole setup back', () => {
    const withFixed: PlanOrder = {
      ...orderOf('1005'),
      jobOrders: orderOf('1005').jobOrders.map((row, index) =>
        index === 0
          ? { ...row, plannedSetupS: 2400, rates: { ...row.rates, fixedSeconds: 600 } }
          : row,
      ),
    };
    const result = combineIntoRun([orderOf('1001'), withFixed], context);

    expect(result.run?.savedSetups.map((saved) => saved.setupS)).toEqual([1800]);
    const moved = result.moves[0];
    expect(moved?.setupS).toBe(600);
    // The row starts where 1001.10 ends, runs its 10 min of fixed time, then its 5 h.
    expect(moved?.to).toEqual({
      setupStartMs: Date.UTC(2026, 10, 4, 7),
      runStartMs: Date.UTC(2026, 10, 4, 7, 10),
      endMs: Date.UTC(2026, 10, 4, 12, 55),
    });
    expect(rowOf(result, '1005.10').plannedSetupS).toBe(600);
    const run = result.run;
    if (run === undefined) throw new Error('no run');
    const split = splitRun(run, result.orders);
    expect(split.orders[1]).toEqual(withFixed);
  });

  it('puts every member of any run of G1 orders of one article back as it was', () => {
    const sameArticle = context.orders.map((order) => ({ ...order, article: 'Bracket L' }));
    const ctx = { ...context, orders: sameArticle };
    const candidates = sameArticle.filter(
      (order) =>
        !order.operations.some((operation) => operation.isLocked) &&
        order.jobOrders.every((row) => row.status === 'planned'),
    );
    fc.assert(
      fc.property(fc.shuffledSubarray(candidates, { minLength: 2, maxLength: 3 }), (members) => {
        const result = combineIntoRun(members, ctx);
        const run = result.run;
        if (run === undefined) throw new Error('no run');
        const split = splitRun(run, result.orders);
        for (const order of split.orders) {
          expect(order).toEqual(members.find((each) => each.id === order.id));
        }
        expect(split.moves.map((move) => move.jobOrderId)).toEqual(
          result.moves.map((move) => move.jobOrderId),
        );
      }),
      { numRuns: 40 },
    );
  });
});
