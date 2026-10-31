// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { type BoardLine, boardFocusInView } from './board-navigation.ts';

const hour = 3_600_000;
/** A view from 10:00 to 20:00 on one day, in hours from midnight. */
const view = { fromMs: 10 * hour, toMs: 20 * hour };

const lines: readonly BoardLine[] = [
  { kind: 'notPlaced', cells: [{ key: 'np-1' }, { key: 'np-2' }, { key: 'np-3' }] },
  {
    kind: 'machine',
    header: 'machine:cnc1',
    cells: [
      { key: 'block:a', fromMs: 2 * hour, toMs: 6 * hour },
      { key: 'block:b', fromMs: 8 * hour, toMs: 12 * hour },
      { key: 'block:c', fromMs: 14 * hour, toMs: 16 * hour },
      { key: 'block:d', fromMs: 18 * hour, toMs: 22 * hour },
    ],
  },
  {
    kind: 'machine',
    header: 'machine:cnc2',
    cells: [{ key: 'block:e', fromMs: 1 * hour, toMs: 3 * hour }],
  },
  { kind: 'machine', header: 'machine:mill1', cells: [{ key: 'empty:mill1' }] },
];

describe('boardFocusInView (ADR 0090, The bar above the timeline)', () => {
  it("#939 moves to the line's first job order that starts in the new view", () => {
    expect(boardFocusInView(lines, 'block:a', view)).toBe('block:c');
    expect(boardFocusInView(lines, 'machine:cnc1', view)).toBe('block:c');
  });

  it("#939 moves to the line's row header when no job order starts in the new view", () => {
    expect(boardFocusInView(lines, 'block:e', view)).toBe('machine:cnc2');
  });

  it('#939 keeps a target the move never unmounts: a Not placed job order and the empty cell', () => {
    expect(boardFocusInView(lines, 'np-2', view)).toBe('np-2');
    expect(boardFocusInView(lines, 'empty:mill1', view)).toBe('empty:mill1');
  });

  it('#939 names nothing for a target the grid does not hold', () => {
    expect(boardFocusInView(lines, 'block:z', view)).toBeUndefined();
  });
});
