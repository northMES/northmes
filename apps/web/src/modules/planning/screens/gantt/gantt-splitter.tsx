// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import type { TreePaneLayout } from './gantt-tree-pane.tsx';

/** One arrow key press moves the splitter by this share of the view. */
const keyStep = 0.02;

/** A share kept to four decimals, so a step reads back as the share it names. */
function rounded(share: number): number {
  return Math.round(share * 10_000) / 10_000;
}

/**
 * The splitter between the tree pane and the time area (#943), the window splitter of the WAI-ARIA
 * practices: a focusable separator whose value is the pane's share of the view in percent. Left
 * and Right move it by 2 percent, Home and End to the least and the most the pane may take. The
 * pointer drags it by its grip over the header row, 24 px wide, so a press near the pane's edge
 * lower down still reaches a block; the line drawn while dragging shows where the pane will end,
 * and the grid lays out again once, on release. Board options holds the one-click alternative to
 * the drag (WCAG 2.5.7). It sits over the grid's edge, outside the treegrid, whose rows may hold
 * only cells.
 */
export function GanttSplitter({
  layout,
  viewWidth,
  gridId,
  gripHeightRem,
  onShareChange,
}: {
  readonly layout: TreePaneLayout;
  /** The grid's width, of which the share is taken. */
  readonly viewWidth: number;
  /** The treegrid the pane belongs to, which the separator controls. */
  readonly gridId: string;
  /** The height of the header row, which the grip covers. */
  readonly gripHeightRem: number;
  readonly onShareChange: (share: number) => void;
}) {
  const percent = (width: number) => Math.round((width / viewWidth) * 100);
  const clamp = (width: number) => Math.min(layout.maxWidth, Math.max(layout.minWidth, width));
  const commit = (width: number) => onShareChange(rounded(clamp(width) / viewWidth));
  /** Where a pointer drag started, and the pane's width then. */
  const drag = useRef<{ readonly pointerId: number; readonly x: number; readonly width: number }>(
    undefined,
  );
  /** The width the drag in progress points at, drawn by the splitter alone until release. */
  const [dragWidth, setDragWidth] = useState<number | undefined>(undefined);
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
    commit(next);
  };
  const endDrag = () => {
    drag.current = undefined;
    setDragWidth(undefined);
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
    // A move with no button pressed means the release went elsewhere.
    if (event.buttons === 0) {
      endDrag();
      return;
    }
    setDragWidth(clamp(start.width + event.clientX - start.x));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === undefined || start.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    // A click without a move keeps the share as chosen, which the pane may round or clamp.
    if (event.clientX !== start.x) commit(start.width + event.clientX - start.x);
    endDrag();
  };
  // A capture lost without a pointerup, as when the window loses focus, ends the drag unapplied.
  const onPointerLost = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) endDrag();
  };
  const left = `${(dragWidth ?? layout.paneWidth) + 1}px`;
  return (
    <>
      <div
        role="separator"
        aria-label="Resize the tree pane"
        aria-controls={gridId}
        aria-orientation="vertical"
        aria-valuenow={percent(layout.paneWidth)}
        aria-valuemin={percent(layout.minWidth)}
        aria-valuemax={percent(layout.maxWidth)}
        aria-valuetext={`Tree pane ${percent(layout.paneWidth)} percent of the view`}
        tabIndex={0}
        data-tree-splitter
        data-dragging={dragWidth === undefined ? undefined : true}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerLost}
        onLostPointerCapture={onPointerLost}
        // From 4 px before the pane's end edge, inside the grid's 1 px border, above the grid's
        // sticky header; 24 px wide (WCAG 2.5.8) and as high as the header row, mostly over the
        // time header, so the last tree column keeps most of its own resize handle.
        className="peer absolute top-px z-30 flex w-(--nm-target-min) -translate-x-1 cursor-col-resize touch-none items-center justify-start outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        style={{ left, height: `${gripHeightRem}rem` }}
      >
        {/* The grip, which shows where the splitter is at rest. */}
        <span aria-hidden className="ms-0.75 h-6 w-1 rounded-full bg-muted-foreground/60" />
      </div>
      {/* The pane's edge as a line down the grid while the grip is hovered, focused or dragged. */}
      <span
        aria-hidden
        data-tree-splitter-line
        className="pointer-events-none absolute inset-y-px z-30 w-0.5 -translate-x-1/2 bg-ring opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100 peer-data-dragging:opacity-100"
        style={{ left }}
      />
    </>
  );
}
