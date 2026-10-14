// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  type DashboardWidgetSize,
  dashboardColumns,
  dashboardSizeUnits,
} from '@northmes/core-contracts';
import { type LayoutItem, moveElement, verticalCompactor } from 'react-grid-layout/core';

/** A widget of a tab in edit mode: what the API answers, without its type name. */
export interface EditedWidget {
  readonly id: string;
  readonly type: 'LIST' | 'TABLE' | 'VALUE' | 'CHART';
  readonly size: Uppercase<DashboardWidgetSize>;
  readonly x: number;
  readonly y: number;
  readonly title: string;
}

/** A direction of a one-step move. */
export type MoveDirection = 'up' | 'down' | 'left' | 'right';

/** A size's width and height in grid units at 12 columns. */
function unitsOf(size: EditedWidget['size']) {
  return dashboardSizeUnits[size.toLowerCase() as DashboardWidgetSize];
}

/** The widgets as react-grid-layout's items; `fixed` names one that stays where it is. */
function itemsOf(widgets: readonly EditedWidget[], fixed?: string): LayoutItem[] {
  return widgets.map(({ id, size, x, y }) => ({
    i: id,
    x,
    y,
    ...unitsOf(size),
    static: id === fixed,
  }));
}

/** The widgets at the places of these items, in their order. */
function placedAt(widgets: readonly EditedWidget[], items: readonly LayoutItem[]): EditedWidget[] {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  return items.flatMap(({ i, x, y }) => {
    const widget = byId.get(i);
    return widget === undefined ? [] : [{ ...widget, x, y }];
  });
}

/**
 * The widgets pulled up as react-grid-layout's vertical compactor draws them, so the layout saved
 * on Done is the one on screen. A fixed widget stays put, and the others flow around it.
 */
export function compactLayout(widgets: readonly EditedWidget[], fixed?: string): EditedWidget[] {
  const compacted = verticalCompactor.compact(itemsOf(widgets, fixed), dashboardColumns);
  return placedAt(widgets, compacted);
}

/** Whether a widget of this size at this place covers a cell of another widget. */
function covers(
  widgets: readonly EditedWidget[],
  size: EditedWidget['size'],
  x: number,
  y: number,
) {
  const { w, h } = unitsOf(size);
  return widgets.some((other) => {
    const units = unitsOf(other.size);
    return x < other.x + units.w && other.x < x + w && y < other.y + units.h && other.y < y + h;
  });
}

/**
 * The first place, row by row and then by column, where a widget of this size covers no other
 * widget: the place of the Add widget tile and of a new widget (design shell-454, C2).
 */
export function firstFreePlace(
  widgets: readonly EditedWidget[],
  size: EditedWidget['size'],
): { x: number; y: number } {
  const { w } = unitsOf(size);
  for (let y = 0; ; y += 1) {
    for (let x = 0; x + w <= dashboardColumns; x += 1) {
      if (!covers(widgets, size, x, y)) return { x, y };
    }
  }
}

/** The widgets after react-grid-layout's moveElement takes one to this place, then compacted. */
function movedTo(widgets: readonly EditedWidget[], id: string, x: number, y: number) {
  const items = itemsOf(widgets);
  const item = items.find(({ i }) => i === id);
  if (item === undefined) return [...widgets];
  const moved = moveElement(items, item, x, y, true, false, 'vertical', dashboardColumns);
  return placedAt(widgets, verticalCompactor.compact(moved, dashboardColumns));
}

/**
 * The widgets after one step of a widget, as a drag of it would leave them (design shell-454, A7):
 * left and right move it one column and push a widget in its way down. As the grid pulls every
 * widget up, a widget goes up or down by passing the next widget in its columns. At the edge of
 * the grid nothing moves, and the same array comes back.
 */
export function moveWidget(
  widgets: readonly EditedWidget[],
  id: string,
  direction: MoveDirection,
): readonly EditedWidget[] {
  const widget = widgets.find((each) => each.id === id);
  if (widget === undefined) return widgets;
  const changed = (next: readonly EditedWidget[]) => {
    const after = next.find((each) => each.id === id);
    return after !== undefined && (after.x !== widget.x || after.y !== widget.y);
  };
  if (direction === 'left' || direction === 'right') {
    const x = widget.x + (direction === 'left' ? -1 : 1);
    if (x < 0 || x + unitsOf(widget.size).w > dashboardColumns) return widgets;
    return movedTo(widgets, id, x, widget.y);
  }
  const bottom = Math.max(...widgets.map(({ size, y }) => y + unitsOf(size).h));
  const sign = direction === 'up' ? -1 : 1;
  for (let rows = 1; rows <= bottom; rows += 1) {
    const y = widget.y + sign * rows;
    if (y < 0) break;
    const next = movedTo(widgets, id, widget.x, y);
    if (changed(next)) return next;
  }
  return widgets;
}

/**
 * The widgets after a widget takes another size where it stands, kept inside the 12 columns; the
 * widgets it would cover move down.
 */
export function resizeWidget(
  widgets: readonly EditedWidget[],
  id: string,
  size: EditedWidget['size'],
): EditedWidget[] {
  const x = (widget: EditedWidget) => Math.min(widget.x, dashboardColumns - unitsOf(size).w);
  const resized = widgets.map((widget) =>
    widget.id === id ? { ...widget, size, x: x(widget) } : widget,
  );
  return compactLayout(compactLayout(resized, id));
}

/** The widgets with a new one at its place; the widgets there move down. */
export function addWidget(widgets: readonly EditedWidget[], widget: EditedWidget): EditedWidget[] {
  return compactLayout(compactLayout([widget, ...widgets], widget.id));
}

/** The widgets without one, pulled up into its room. */
export function removeWidget(widgets: readonly EditedWidget[], id: string): EditedWidget[] {
  return compactLayout(widgets.filter((widget) => widget.id !== id));
}

/** A widget's place in words, counted from one, as the polite region says it (design shell-454, B7). */
export function positionText({ x, y }: Pick<EditedWidget, 'x' | 'y'>): string {
  return `Column ${x + 1}, row ${y + 1}.`;
}

/** The name of a size, such as Medium. */
export function sizeName(size: EditedWidget['size']): string {
  return `${size.charAt(0)}${size.slice(1).toLowerCase()}`;
}

/** A size with its width and height in grid units, such as "Medium 4 by 4" (design shell-454, B3). */
export function sizeText(size: EditedWidget['size']): string {
  const { w, h } = unitsOf(size);
  return `${sizeName(size)} ${w} by ${h}`;
}

/** The layout as the JSON of core.saveDashboardTab's layout field (ADR 0078). */
export function layoutInput(widgets: readonly EditedWidget[]): string {
  return JSON.stringify(
    widgets.map(({ id, type, size, x, y, title }) => ({
      id,
      type: type.toLowerCase(),
      size: size.toLowerCase(),
      x,
      y,
      settings: { title },
    })),
  );
}
