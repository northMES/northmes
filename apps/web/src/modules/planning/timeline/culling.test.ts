// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { visibleItems, visibleSlice } from './culling.ts';

const blocks = [
  { id: 'a', fromMs: 0, toMs: 10 },
  { id: 'b', fromMs: 20, toMs: 30 },
  { id: 'c', fromMs: 40, toMs: 50 },
  { id: 'd', fromMs: 60, toMs: 70 },
];

describe('culling (plan 18, Shared pieces)', () => {
  it('finds the blocks that touch the range by binary search, a block cut by either edge included', () => {
    expect(visibleSlice(blocks, { fromMs: 25, toMs: 45 })).toEqual({ from: 1, to: 3 });
    expect(visibleItems(blocks, { fromMs: 25, toMs: 45 }).map((b) => b.id)).toEqual(['b', 'c']);
    expect(visibleItems(blocks, { fromMs: 30, toMs: 40 })).toEqual([]);
    expect(visibleItems(blocks, { fromMs: -5, toMs: 1 }).map((b) => b.id)).toEqual(['a']);
    expect(visibleItems(blocks, { fromMs: 69, toMs: 100 }).map((b) => b.id)).toEqual(['d']);
    expect(visibleItems([], { fromMs: 0, toMs: 100 })).toEqual([]);
  });
});
