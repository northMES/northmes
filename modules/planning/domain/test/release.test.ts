// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1PlanContext, lastPieceMinEnd, releaseOf } from '../src/index.ts';

const context = g1PlanContext();
const order = (number: string) => {
  const found = context.orders.find((each) => each.number === number);
  if (found === undefined) throw new Error(`no order ${number}`);
  return found;
};

describe('releaseOf (plan 07, Rules between operations)', () => {
  it('GT1 the release of 1001.20 is the end of 1001.10 plus its 1 h lead time', () => {
    expect(releaseOf(order('1001'), '1001.20', context)).toEqual({
      fromRow: '1001.10',
      fromJobOrderId: 'jo-1001-10',
      pointMs: Date.UTC(2026, 10, 4, 7),
      atMs: Date.UTC(2026, 10, 4, 8),
    });
  });

  it('GT4 the release of 300 pieces of 1004.10 is Thu 09:15, the setup end plus 9 000 s of run across the break, plus the lead time Thu 09:45', () => {
    expect(releaseOf(order('1004'), '1004.20', context)).toEqual({
      fromRow: '1004.10',
      fromJobOrderId: 'jo-1004-10',
      pointMs: Date.UTC(2026, 10, 5, 8, 15),
      atMs: Date.UTC(2026, 10, 5, 8, 45),
    });
  });

  it('GT4 the last-piece bound of 1004.20 is 1004.10 end plus lead plus one cycle, Fri 08:45:20', () => {
    const row = order('1004').jobOrders.find((each) => each.displayNumber === '1004.20');

    expect(row && lastPieceMinEnd(order('1004'), row, context)).toBe(
      Date.UTC(2026, 10, 6, 7, 45, 20),
    );
  });

  it('a first operation has no release', () => {
    expect(releaseOf(order('1001'), '1001.10', context)).toBeUndefined();
  });
});
