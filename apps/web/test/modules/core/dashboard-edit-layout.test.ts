// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  addWidget,
  compactLayout,
  type EditedWidget,
  firstFreePlace,
  layoutInput,
  moveWidget,
  positionText,
  removeWidget,
  resizeWidget,
  sizeText,
} from '../../../src/modules/core/screens/dashboard/dashboard-edit-layout.ts';

/** A List widget with the place and size the test needs. */
function at(id: string, size: EditedWidget['size'], x: number, y: number): EditedWidget {
  return { id, type: 'LIST', size, x, y, title: `Widget ${id}` };
}

/** Each widget's id and place, in reading order. */
function places(widgets: readonly EditedWidget[]): string[] {
  return [...widgets]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(({ id, x, y }) => `${id} ${x},${y}`);
}

describe('the edited layout of a dashboard tab (design shell-454, option A)', () => {
  it('pulls the widgets up, as the grid shows them, so the saved layout is the one on screen', () => {
    expect(places(compactLayout([at('a', 'MEDIUM', 0, 3), at('b', 'MEDIUM', 4, 9)]))).toEqual([
      'a 0,0',
      'b 4,0',
    ]);
  });

  it('finds the first free place of a size, row by row, then by column', () => {
    const widgets = [at('a', 'MEDIUM', 0, 0), at('b', 'MEDIUM', 4, 0), at('c', 'SMALL', 8, 0)];

    expect(firstFreePlace(widgets, 'SMALL')).toEqual({ x: 8, y: 2 });
    expect(firstFreePlace(widgets, 'MEDIUM')).toEqual({ x: 8, y: 2 });
    expect(firstFreePlace(widgets, 'LARGE')).toEqual({ x: 0, y: 4 });
    expect(firstFreePlace([], 'WIDE')).toEqual({ x: 0, y: 0 });
  });

  it('moves a widget one column left or right, and pushes a widget in its way down', () => {
    const widgets = [at('a', 'MEDIUM', 0, 0), at('b', 'SMALL', 4, 0)];

    expect(places(moveWidget(widgets, 'a', 'right'))).toEqual(['a 1,0', 'b 4,4']);
    expect(places(moveWidget(widgets, 'b', 'left'))).toEqual(['b 3,0', 'a 0,2']);
  });

  it('moves a widget up or down past the next widget in its columns', () => {
    const widgets = [at('a', 'MEDIUM', 0, 0), at('b', 'MEDIUM', 0, 4), at('c', 'SMALL', 4, 0)];

    expect(places(moveWidget(widgets, 'a', 'down'))).toEqual(['b 0,0', 'c 4,0', 'a 0,4']);
    expect(places(moveWidget(widgets, 'b', 'up'))).toEqual(['b 0,0', 'c 4,0', 'a 0,4']);
  });

  it('leaves the layout as it is at the edge of the grid', () => {
    const widgets = [at('a', 'MEDIUM', 0, 0), at('b', 'MEDIUM', 8, 0)];

    expect(moveWidget(widgets, 'a', 'left')).toBe(widgets);
    expect(moveWidget(widgets, 'a', 'up')).toBe(widgets);
    expect(moveWidget(widgets, 'a', 'down')).toBe(widgets);
    expect(moveWidget(widgets, 'b', 'right')).toBe(widgets);
  });

  it('gives a widget a new size where it stands, and moves the widgets it would cover', () => {
    const widgets = [at('a', 'MEDIUM', 0, 0), at('b', 'SMALL', 4, 0), at('c', 'MEDIUM', 0, 4)];

    const resized = resizeWidget(widgets, 'a', 'TALL');

    expect(places(resized)).toEqual(['a 0,0', 'c 0,6', 'b 4,6']);
    expect(resized.find(({ id }) => id === 'a')?.size).toBe('TALL');
  });

  it('keeps a widget that grows inside the 12 columns', () => {
    expect(places(resizeWidget([at('a', 'MEDIUM', 8, 0)], 'a', 'WIDE'))).toEqual(['a 0,0']);
  });

  it('adds a widget at its place, moving the widgets there down, and removes one', () => {
    const widgets = [at('a', 'MEDIUM', 0, 0), at('b', 'SMALL', 4, 0)];

    const added = addWidget(widgets, at('n', 'SMALL', 0, 0));

    expect(places(added)).toEqual(['n 0,0', 'b 4,0', 'a 0,2']);
    expect(places(removeWidget(added, 'n'))).toEqual(['a 0,0', 'b 4,0']);
  });

  it('names a place by its column and row, counted from one', () => {
    expect(positionText(at('a', 'MEDIUM', 4, 0))).toBe('Column 5, row 1.');
  });

  it('names a size with its width and height in grid units', () => {
    expect(sizeText('MEDIUM')).toBe('Medium 4 by 4');
    expect(sizeText('WIDE')).toBe('Wide 12 by 4');
  });

  it('writes the layout as the JSON core.saveDashboardTab takes', () => {
    const input = layoutInput([{ ...at('a', 'MEDIUM', 4, 0), title: 'Production orders' }]);

    expect(JSON.parse(input)).toEqual([
      {
        id: 'a',
        type: 'list',
        size: 'medium',
        x: 4,
        y: 0,
        settings: { title: 'Production orders' },
      },
    ]);
  });
});
