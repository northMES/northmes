// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DashboardWidgetSize, dashboardSizeUnits } from '@northmes/core-contracts';

/** A widget's size as the API names it. */
type Size = Uppercase<DashboardWidgetSize>;

/** What the layout reads of a widget: its id, its size and its place at 12 columns. */
export interface PlacedWidget {
  readonly id: string;
  readonly size: Size;
  readonly x: number;
  readonly y: number;
}

/** Each size's width in grid units at 6 columns (design shell-454). */
const sixColumnWidths: Readonly<Record<DashboardWidgetSize, number>> = {
  small: 3,
  medium: 3,
  large: 6,
  tall: 6,
  wide: 6,
};

/** One item of react-grid-layout's layout. A viewed tab's items do not move. */
export interface GridItem {
  readonly i: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly static: true;
}

/** The grid's columns: 12 or 6, or 1 below 600 px, where the widgets form a list. */
export type GridColumns = 12 | 6 | 1;

/**
 * The columns of a grid container this wide (design shell-454): 12 from 900 px, 6 from 600 px,
 * else one. They are measured on the container, since the sidebar and the rail change its room.
 */
export function columnsFor(width: number): GridColumns {
  if (width >= 900) return 12;
  if (width >= 600) return 6;
  return 1;
}

/** The widgets in reading order: row by row, then by column (WCAG 2.4.3, 1.3.2). */
export function readingOrder<Widget extends PlacedWidget>(widgets: readonly Widget[]): Widget[] {
  return [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * The layout of the widgets at 12 or 6 columns. The stored layout is the 12-column one, and the
 * 6-column one follows from it: each column halves, each size takes its 6-column width, and a
 * widget that would reach past the edge moves left. react-grid-layout's compactor then pulls the
 * widgets up and keeps them from overlapping.
 */
export function gridLayout(widgets: readonly PlacedWidget[], columns: 12 | 6): GridItem[] {
  return readingOrder(widgets).map(({ id, size, x, y }) => {
    const key = size.toLowerCase() as DashboardWidgetSize;
    const { w, h } = dashboardSizeUnits[key];
    if (columns === 12) return { i: id, x, y, w, h, static: true };
    const narrow = sixColumnWidths[key];
    return { i: id, x: Math.min(Math.floor(x / 2), 6 - narrow), y, w: narrow, h, static: true };
  });
}
