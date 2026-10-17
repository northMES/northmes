// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { floatOf, g1Expected, g1PlanContext, type PlanContext, type PlanOrder } from '../src/index.ts';

const context = g1PlanContext();

function orderOf(number: string, from: PlanContext = context): PlanOrder {
  const found = from.orders.find((each) => each.number === number);
  if (found === undefined) throw new Error(`no order ${number}`);
  return found;
}

/** The expected float of a row, in the domain's shape: the fixture's prose detail is not compared. */
function expectedFloat(displayNumber: string) {
  const values = g1Expected.GT1_GT2_floats[displayNumber];
  if (values === undefined) throw new Error(`no expected float for ${displayNumber}`);
  const { detail: _detail, ...binding } = values.bindingConstraint;
  return {
    earliestStartMs: Date.parse(values.earliestStart.instant),
    waitWorkingS: values.waitWorkingS,
    latestStartMs: Date.parse(values.latestStart.instant),
    latestEndMs: Date.parse(values.latestEnd.instant),
    totalFloatWorkingS: values.totalFloatWorkingS,
    freeFloatWorkingS: values.freeFloatWorkingS,
    binding,
    critical: values.critical,
  };
}

describe('floatOf (plan 18, Float and the critical chain)', () => {
  it('GT1 gives 1001.10 and 1001.20 their earliest start, wait, latest start and end, floats and binding constraint', () => {
    const result = floatOf(orderOf('1001'), context);

    expect(result.rows['jo-1001-10']).toEqual(expectedFloat('1001.10'));
    expect(result.rows['jo-1001-20']).toEqual(expectedFloat('1001.20'));
    expect(result).toMatchObject({
      late: false,
      slackElapsedS: 101_700,
      plannedEndMs: Date.UTC(2026, 10, 5, 9, 45),
    });
  });

  it('GT2 gives both rows of 1003 minus 900 s of total float, zero free float, critical, machine then release', () => {
    const result = floatOf(orderOf('1003'), context);

    expect(result.rows['jo-1003-10']).toEqual(expectedFloat('1003.10'));
    expect(result.rows['jo-1003-20']).toEqual(expectedFloat('1003.20'));
    expect(result).toMatchObject({
      late: true,
      slackElapsedS: -54_900,
      plannedEndMs: Date.UTC(2026, 10, 5, 5, 15),
      lateByWorking: { seconds: 900, equipment: 'MILL1' },
    });
  });

  it("a started row's earliest start is its actual start and its binding constraint is started", () => {
    const order = orderOf('1001');
    const started: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) =>
        row.displayNumber === '1001.10'
          ? { ...row, status: 'started', actualStartMs: Date.UTC(2026, 10, 3, 10, 45) }
          : row,
      ),
    };

    expect(floatOf(started, { ...context, orders: [started, ...context.orders.slice(1)] }).rows['jo-1001-10']).toMatchObject({
      earliestStartMs: Date.UTC(2026, 10, 3, 10, 45),
      binding: { kind: 'started' },
    });
  });

  it('a hard-locked row binds as hardLock, and a row at the fence as frozenWindow', () => {
    const locked = floatOf(orderOf('1002'), context).rows['jo-1002-10'];
    expect(locked).toMatchObject({ binding: { kind: 'hardLock' }, waitWorkingS: 0 });

    const order = orderOf('1006');
    const atFence: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) => ({
        ...row,
        placement: {
          setupStartMs: context.fenceMs,
          runStartMs: context.fenceMs,
          endMs: Date.UTC(2026, 10, 3, 12),
        },
      })),
    };
    expect(floatOf(atFence, context).rows['jo-1006-10']).toMatchObject({
      binding: { kind: 'frozenWindow' },
      waitWorkingS: 0,
    });
  });

  it('is permutation-invariant in the orders, operations and job orders', () => {
    const expected = floatOf(orderOf('1003'), context);
    const shuffle = <T>(items: readonly T[]) => fc.shuffledSubarray(items, { minLength: items.length });
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
          expect(floatOf(orderOf('1003', permuted), permuted)).toEqual(expected);
        },
      ),
      { numRuns: 25 },
    );
  });
});
