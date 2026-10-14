// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  columnsFor,
  gridLayout,
  readingOrder,
} from '../../../src/modules/core/screens/dashboard/dashboard-layout.ts';

/** A widget with the place and size the test needs. */
function at(
  id: string,
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'TALL' | 'WIDE',
  x: number,
  y: number,
) {
  return { id, size, x, y };
}

describe('the dashboard layout (design shell-454, Breakpoints and sizes)', () => {
  it('measures the columns on the grid container: 12 from 900 px, 6 from 600 px, else one', () => {
    expect([1134, 900, 899, 600, 599, 288].map(columnsFor)).toEqual([12, 12, 6, 6, 1, 1]);
  });

  it('orders the widgets row by row, then by column', () => {
    const widgets = [at('c', 'MEDIUM', 0, 2), at('b', 'SMALL', 3, 0), at('a', 'SMALL', 0, 0)];

    expect(readingOrder(widgets).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  it('gives each size its width and height in grid units at 12 columns', () => {
    const widgets = [
      at('small', 'SMALL', 0, 0),
      at('medium', 'MEDIUM', 3, 0),
      at('large', 'LARGE', 0, 4),
      at('tall', 'TALL', 6, 4),
      at('wide', 'WIDE', 0, 10),
    ];

    expect(gridLayout(widgets, 12)).toEqual([
      { i: 'small', x: 0, y: 0, w: 3, h: 2, static: true },
      { i: 'medium', x: 3, y: 0, w: 4, h: 4, static: true },
      { i: 'large', x: 0, y: 4, w: 6, h: 4, static: true },
      { i: 'tall', x: 6, y: 4, w: 6, h: 6, static: true },
      { i: 'wide', x: 0, y: 10, w: 12, h: 4, static: true },
    ]);
  });

  it('at 6 columns halves the column, keeps each widget inside the grid and narrows Medium and Wide', () => {
    const widgets = [
      at('medium', 'MEDIUM', 8, 0),
      at('small', 'SMALL', 9, 4),
      at('wide', 'WIDE', 0, 8),
    ];

    expect(gridLayout(widgets, 6)).toEqual([
      { i: 'medium', x: 3, y: 0, w: 3, h: 4, static: true },
      { i: 'small', x: 3, y: 4, w: 3, h: 2, static: true },
      { i: 'wide', x: 0, y: 8, w: 6, h: 4, static: true },
    ]);
  });
});
