// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type KeyboardEvent, type PointerEvent, useRef } from 'react';

/** One key press narrows or widens a column by this many pixels. */
export const columnKeyStepPx = 8;

/**
 * The width a key press asks for: Left or Right narrow or widen by 8 px, with Alt held when the
 * caller says so and without it otherwise; any other key, or another modifier, asks for none.
 */
export function keyedWidth(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  width: number,
  options: { readonly alt: boolean },
): number | undefined {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey !== options.alt) {
    return undefined;
  }
  if (event.key === 'ArrowLeft') return width - columnKeyStepPx;
  if (event.key === 'ArrowRight') return width + columnKeyStepPx;
  return undefined;
}

/**
 * The resize handle on a column header's end edge (#943): a focusable separator whose value is the
 * column's width in pixels, 24 px wide inside its own header (WCAG 2.5.8). The pointer drags it,
 * and Left and Right, with or without Alt, narrow and widen the column by 8 px, never under its
 * least width. A drag reports each width as it goes and the last one as done, so the screen keeps
 * the width once, on release. The header that holds it is relatively positioned. In a grid that
 * keeps one Tab stop, as the board's, the handle takes none, and the grid offers the keys on a
 * cell of the column instead.
 */
export function ColumnResizer({
  column,
  width,
  minWidth,
  maxWidth,
  focusable = true,
  onWidthChange,
}: {
  /** The column's header text, which the handle's name carries. */
  readonly column: string;
  readonly width: number;
  readonly minWidth: number;
  readonly maxWidth: number;
  /** Whether the handle is a Tab stop. */
  readonly focusable?: boolean;
  /** A width to show, and whether it is the one to keep: true for a key and a release. */
  readonly onWidthChange: (width: number, done: boolean) => void;
}) {
  const clamp = (next: number) => Math.round(Math.min(maxWidth, Math.max(minWidth, next)));
  /** Where a pointer drag started, and the column's width then. */
  const drag = useRef<{ readonly pointerId: number; readonly x: number; readonly width: number }>(
    undefined,
  );
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      keyedWidth(event, width, { alt: false }) ?? keyedWidth(event, width, { alt: true });
    if (next === undefined) return;
    // The grid's own arrow keys stay out of it.
    event.preventDefault();
    event.stopPropagation();
    onWidthChange(clamp(next), true);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, width };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === undefined || start.pointerId !== event.pointerId) return;
    // A move with no button pressed means the release went elsewhere: the start width comes back.
    if (event.buttons === 0) {
      drag.current = undefined;
      onWidthChange(start.width, true);
      return;
    }
    onWidthChange(clamp(start.width + event.clientX - start.x), false);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === undefined || start.pointerId !== event.pointerId) return;
    drag.current = undefined;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    // A click without a move keeps nothing.
    if (event.clientX !== start.x)
      onWidthChange(clamp(start.width + event.clientX - start.x), true);
  };
  // A capture lost without a pointerup, as when the window loses focus, puts the start width back.
  const onPointerLost = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === undefined || start.pointerId !== event.pointerId) return;
    drag.current = undefined;
    onWidthChange(start.width, true);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: an hr cannot take focus or the arrow keys; a resize handle is a focusable separator.
    <div
      role="separator"
      aria-label={`Resize the ${column} column`}
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuetext={`${width} px`}
      tabIndex={focusable ? 0 : -1}
      data-column-resizer
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerLost}
      onLostPointerCapture={onPointerLost}
      // A click on the handle is not a click on the header's sort button or the board's row.
      onClick={(event) => event.stopPropagation()}
      className="group absolute inset-y-0 end-0 z-10 flex w-(--nm-target-min) cursor-col-resize touch-none justify-end outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <span
        aria-hidden
        className="h-full w-0.5 group-hover:bg-ring group-focus-visible:bg-ring group-active:bg-ring"
      />
    </div>
  );
}
