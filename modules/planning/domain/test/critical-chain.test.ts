// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  criticalChain,
  g1PlanContext,
  type PlanContext,
  type PlanJobOrder,
  type PlanOrder,
} from '../src/index.ts';

const context = g1PlanContext();
const thuAt = (hour: number, minute = 0) => Date.UTC(2026, 10, 5, hour, minute);
const friAt = (hour: number, minute = 0) => Date.UTC(2026, 10, 6, hour, minute);

function orderOf(number: string, from: PlanContext = context): PlanOrder {
  const found = from.orders.find((each) => each.number === number);
  if (found === undefined) throw new Error(`no order ${number}`);
  return found;
}

/** The context with one order replaced. */
function withOrder(order: PlanOrder, from: PlanContext = context): PlanContext {
  return { ...from, orders: from.orders.map((each) => (each.id === order.id ? order : each)) };
}

describe('criticalChain (plan 18, Float and the critical chain)', () => {
  it('GT1 the chain of 1001 is 1001.20 by its release, then 1001.10 free as the root, with no critical row', () => {
    const chain = criticalChain(orderOf('1001'), context);

    expect(chain).toMatchObject({
      late: false,
      slackElapsedS: 101_700,
      continues: false,
      criticalRows: [],
    });
    expect(
      chain.rows.map(({ row, bindingText, root, otherOrder }) => ({
        row,
        bindingText,
        root,
        otherOrder,
      })),
    ).toEqual([
      { row: '1001.20', bindingText: 'release from 1001.10', root: false, otherOrder: undefined },
      { row: '1001.10', bindingText: 'free', root: true, otherOrder: undefined },
    ]);
  });

  it('GT2 the chain of 1003 walks through the machine to 1001.10 of order 1001 as its free root, both 1003 rows critical', () => {
    const chain = criticalChain(orderOf('1003'), context);

    expect(chain).toMatchObject({
      late: true,
      slackElapsedS: -54_900,
      criticalRows: ['1003.10', '1003.20'],
    });
    expect(chain.rows).toEqual([
      expect.objectContaining({
        row: '1003.20',
        jobOrderId: 'jo-1003-20',
        orderId: 'po-1003',
        bindingText: 'release from 1003.10',
        critical: true,
        root: false,
        waitWorkingS: 0,
        totalFloatWorkingS: -900,
        freeFloatWorkingS: 0,
      }),
      expect.objectContaining({
        row: '1003.10',
        bindingText: 'machine CNC1 occupied by 1001.10',
        critical: true,
        root: false,
        waitWorkingS: 24_600,
      }),
      expect.objectContaining({
        row: '1001.10',
        jobOrderId: 'jo-1001-10',
        orderId: 'po-1001',
        otherOrder: '1001',
        bindingText: 'free',
        critical: false,
        root: true,
        totalFloatWorkingS: 42_300,
      }),
    ]);
  });

  it('a chain that reaches a hard-locked row stops there with root hardLock', () => {
    // 1001.20 on CNC2 right after the locked 1002.10: its machine binds it, and the lock is the root.
    const order = orderOf('1001');
    const moved: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) =>
        row.displayNumber === '1001.20'
          ? {
              ...row,
              placement: {
                setupStartMs: Date.UTC(2026, 10, 6, 5),
                runStartMs: Date.UTC(2026, 10, 6, 5),
                endMs: Date.UTC(2026, 10, 9, 7),
              },
            }
          : row,
      ),
    };
    const chain = criticalChain(moved, withOrder(moved));

    expect(chain.rows.map(({ row, binding, root }) => ({ row, kind: binding.kind, root }))).toEqual(
      [
        { row: '1001.20', kind: 'machine', root: false },
        { row: '1002.10', kind: 'hardLock', root: true },
      ],
    );
    expect(chain.rows[1]?.otherOrder).toBe('1002');
  });

  it('a chain that reaches the fence stops there with root frozenWindow', () => {
    // GT8 with now Tue 09:40: 1001.10 starts at the fence and 1003.10 waits for it on CNC1.
    const later: PlanContext = {
      ...context,
      nowMs: Date.UTC(2026, 10, 3, 8, 40),
      fenceMs: Date.UTC(2026, 10, 4, 8, 40),
    };
    const order = orderOf('1001');
    const atFence: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) =>
        row.displayNumber === '1001.10'
          ? {
              ...row,
              placement: {
                setupStartMs: Date.UTC(2026, 10, 4, 8, 40),
                runStartMs: Date.UTC(2026, 10, 4, 9, 10),
                endMs: Date.UTC(2026, 10, 5, 7, 10),
              },
            }
          : row,
      ),
    };
    const order1003 = orderOf('1003');
    const after: PlanOrder = {
      ...order1003,
      jobOrders: order1003.jobOrders.map((row) =>
        row.displayNumber === '1003.10'
          ? {
              ...row,
              placement: {
                setupStartMs: Date.UTC(2026, 10, 5, 7, 10),
                runStartMs: Date.UTC(2026, 10, 5, 7, 10),
                endMs: Date.UTC(2026, 10, 5, 12),
              },
            }
          : {
              ...row,
              placement: {
                setupStartMs: Date.UTC(2026, 10, 5, 12),
                runStartMs: Date.UTC(2026, 10, 5, 12),
                endMs: Date.UTC(2026, 10, 6, 5, 30),
              },
            },
      ),
    };
    const chain = criticalChain(after, withOrder(after, withOrder(atFence, later)));

    expect(chain.rows.map(({ row, binding, root }) => ({ row, kind: binding.kind, root }))).toEqual(
      [
        { row: '1003.20', kind: 'release', root: false },
        { row: '1003.10', kind: 'machine', root: false },
        { row: '1001.10', kind: 'frozenWindow', root: true },
      ],
    );
  });

  it('follows a split operation by job order id: the release names the latest-ending row, the machine its sibling', () => {
    // 1004.10 split into two rows of 600 on CNC1, back to back, no send-ahead: 1004.20 is released
    // by the second row, which starts when the first ends, and the first is the free root.
    const order = orderOf('1004');
    const turn = order.jobOrders.find((row) => row.displayNumber === '1004.10');
    if (turn === undefined) throw new Error('no 1004.10');
    const first = { ...turn, id: 'jo-1004-10a', quantity: 600, plannedRunS: 18_000 };
    const second = {
      ...first,
      id: 'jo-1004-10b',
      placement: { setupStartMs: thuAt(11, 15), runStartMs: thuAt(11, 45), endMs: friAt(8) },
    };
    const mill = order.jobOrders.find((row) => row.displayNumber === '1004.20');
    if (mill === undefined) throw new Error('no 1004.20');
    const split: PlanOrder = {
      ...order,
      operations: order.operations.map((operation) =>
        operation.displayNumber === '1004.10' ? { ...operation, sendAheadQuantity: 0 } : operation,
      ),
      jobOrders: [
        {
          ...first,
          placement: { setupStartMs: thuAt(5), runStartMs: thuAt(5, 30), endMs: thuAt(11, 15) },
        },
        second,
        {
          ...mill,
          placement: {
            setupStartMs: friAt(8, 30),
            runStartMs: friAt(8, 30),
            endMs: Date.UTC(2026, 10, 9, 6, 40),
          },
        },
      ],
    };
    const chain = criticalChain(split, withOrder(split));

    expect(
      chain.rows.map(({ row, jobOrderId, binding, root }) => ({ row, jobOrderId, binding, root })),
    ).toEqual([
      {
        row: '1004.20',
        jobOrderId: 'jo-1004-20',
        binding: { kind: 'release', boundBy: '1004.10', boundByJobOrderId: 'jo-1004-10b' },
        root: false,
      },
      {
        row: '1004.10',
        jobOrderId: 'jo-1004-10b',
        binding: {
          kind: 'machine',
          boundBy: '1004.10',
          boundByJobOrderId: 'jo-1004-10a',
          equipment: 'CNC1',
        },
        root: false,
      },
      { row: '1004.10', jobOrderId: 'jo-1004-10a', binding: { kind: 'free' }, root: true },
    ]);
  });

  it('a chain longer than 20 rows ends with "chain continues"', () => {
    // Thirty orders of one 3 600 s row each, back to back on CNC1 from the fence, the last one asked.
    const rates = {
      cycleSeconds: 60,
      piecesPerCycle: 1,
      cyclesPerPiece: 1,
      planningFactor: 1,
      retoolSeconds: 0,
      fixedSeconds: 0,
    };
    const windows = context.availability.CNC1 ?? [];
    const orders: PlanOrder[] = [];
    let cursor = context.fenceMs;
    for (let index = 0; index < 30; index += 1) {
      const number = `2${String(index).padStart(3, '0')}`;
      const startMs = cursor;
      const endMs = (() => {
        let remaining = 3_600_000;
        let at = startMs;
        for (const window of windows) {
          if (window.toMs <= at) continue;
          const from = Math.max(at, window.fromMs);
          const take = Math.min(remaining, window.toMs - from);
          remaining -= take;
          at = from + take;
          if (remaining === 0) break;
        }
        return at;
      })();
      cursor = endMs;
      const row: PlanJobOrder = {
        id: `jo-${number}`,
        operationId: `${number}.10`,
        displayNumber: `${number}.10`,
        equipment: 'CNC1',
        quantity: 60,
        status: 'planned',
        placement: { setupStartMs: startMs, runStartMs: startMs, endMs },
        plannedSetupS: 0,
        plannedRunS: 3600,
        rates,
      };
      orders.push({
        id: `po-${number}`,
        number,
        deadlineMs: Date.UTC(2026, 10, 27, 14),
        priority: null,
        operations: [
          {
            id: `${number}.10`,
            displayNumber: `${number}.10`,
            sequence: 10,
            quantity: 60,
            rates,
            leadTimeS: 0,
            sendAheadQuantity: 0,
            isLocked: false,
            allowedEquipment: ['CNC1'],
          },
        ],
        jobOrders: [row],
      });
    }
    const last = orders[orders.length - 1];
    if (last === undefined) throw new Error('no orders');
    const chain = criticalChain(last, { ...context, orders });

    expect(chain.rows).toHaveLength(20);
    expect(chain.continues).toBe(true);
    expect(chain.rows[19]?.root).toBe(false);
  });
});
