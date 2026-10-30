// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import type { TreePaneLayout } from './gantt-tree-pane.tsx';

/** One arrow key press moves the splitter by this share of the view. */
const keyStep = 0.02;

/** A share kept to four decimals, so a step reads back as the share it names. */
function rounded(share: number): number {
  return Math.round(share * 10_000) / 10_000;
}

/**
 * The splitter between the tree pane and the time area (#943), the window splitter of the WAI-ARIA
 * practices: a focusable separator whose value is the pane's share of the view in percent. The
 * pointer drags it; Left and Right move it by 2 percent, Home and End to the least and the most
 * the pane may take. It sits over the grid's edge at the pane's end, outside the treegrid, whose
 * rows may hold only cells.
 */
export function GanttSplitter({
  layout,
  viewWidth,
  onShareChange,
}: {
  readonly layout: TreePaneLayout;
  /** The grid's width, of which the share is taken. */
  readonly viewWidth: number;
  readonly onShareChange: (share: number) => void;
}) {
  const percent = (width: number) => Math.round((width / viewWidth) * 100);
  const setWidth = (width: number) =>
    onShareChange(rounded(Math.min(layout.maxWidth, Math.max(layout.minWidth, width)) / viewWidth));
  /** Where a pointer drag started, and the pane's width then. */
  const drag = useRef<{ readonly pointerId: number; readonly x: number; readonly width: number }>(
    undefined,
  );
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const share = layout.paneWidth / viewWidth;
    const next = {
      ArrowLeft: rounded(share - keyStep) * viewWidth,
      ArrowRight: rounded(share + keyStep) * viewWidth,
      Home: layout.minWidth,
      End: layout.maxWidth,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setWidth(next);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, width: layout.paneWidth };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === undefined || start.pointerId !== event.pointerId) return;
    setWidth(start.width + event.clientX - start.x);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return (
    <div
      role="separator"
      aria-label="Resize the tree pane"
      aria-orientation="vertical"
      aria-valuenow={percent(layout.paneWidth)}
      aria-valuemin={percent(layout.minWidth)}
      aria-valuemax={percent(layout.maxWidth)}
      aria-valuetext={`Tree pane ${percent(layout.paneWidth)} percent of the view`}
      tabIndex={0}
      data-tree-splitter
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      // Centred on the pane's end edge, inside the grid's 1 px border; above the grid's sticky
      // header, and wide enough to grab without covering a header's sort button.
      className="group absolute inset-y-px z-30 flex w-2 -translate-x-1/2 cursor-col-resize touch-none justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ left: `${layout.paneWidth + 1}px` }}
    >
      <span
        aria-hidden
        className="h-full w-0.5 group-hover:bg-ring group-focus-visible:bg-ring group-active:bg-ring"
      />
    </div>
  );
}
