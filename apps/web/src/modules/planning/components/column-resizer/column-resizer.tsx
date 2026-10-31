// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Minus, Plus } from 'lucide-react';
import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';

/** One key press narrows or widens a column by this many pixels. */
export const columnKeyStepPx = 8;

/** One press of Narrower or Wider changes a column by this many pixels. */
const buttonStepPx = 16;

/** A press that moves less than this is a click, as a tap that wanders a pixel or two. */
const dragThresholdPx = 3;

/** A width within a column's bounds, in whole pixels. */
export function widthWithin(width: number, minWidth: number, maxWidth: number): number {
  return Math.round(Math.min(maxWidth, Math.max(minWidth, width)));
}

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
 * A change of a column's width: a width to show while a drag goes on (done false), a width to keep
 * (done true), or the end of a drag with nothing to keep (width undefined).
 */
export type ColumnWidthChange = (width: number | undefined, done: boolean) => void;

/**
 * The resize handle on a column header's end edge (#943): a separator whose value is the column's
 * width in pixels, 24 px wide inside its own header (WCAG 2.5.8). The pointer drags it; Left and
 * Right, with or without Alt, narrow and widen the column by 8 px, never under its least width. A
 * click without a drag shows Narrower and Wider buttons beside it, the one-click alternative to the
 * drag (WCAG 2.5.7). A drag shows the column live, or with `preview="line"` draws a line where
 * the edge will go and changes the width once, on release, for a view whose layout a width change
 * rebuilds. A drag the window cuts short, or that the handle leaves by unmounting, keeps nothing.
 * In a grid that keeps one Tab stop, as the board's, the handle takes none, and the grid takes
 * the keys. The header that holds it is relatively positioned.
 */
export function ColumnResizer({
  column,
  width,
  minWidth,
  maxWidth,
  focusable = true,
  preview = 'live',
  onWidthChange,
}: {
  /** The column's header text, which the handle's name carries. */
  readonly column: string;
  readonly width: number;
  readonly minWidth: number;
  readonly maxWidth: number;
  /** Whether the handle is a Tab stop. */
  readonly focusable?: boolean;
  readonly preview?: 'live' | 'line';
  readonly onWidthChange: ColumnWidthChange;
}) {
  const clamp = (next: number) => widthWithin(next, minWidth, maxWidth);
  /** Where a pointer drag started, the column's width then, and whether the pointer moved. */
  const drag = useRef<
    | { readonly pointerId: number; readonly x: number; readonly width: number; moved: boolean }
    | undefined
  >(undefined);
  /** The width a drag in line preview points at. */
  const [lineWidth, setLineWidth] = useState<number | undefined>(undefined);
  /** Whether the Narrower and Wider buttons show. */
  const [stepping, setStepping] = useState(false);
  // The latest callback, for a drag the handle leaves by unmounting.
  const latest = useRef(onWidthChange);
  useEffect(() => {
    latest.current = onWidthChange;
  });
  useEffect(
    () => () => {
      if (drag.current?.moved === true) latest.current(undefined, true);
    },
    [],
  );
  const endDrag = (keep: number | undefined) => {
    const start = drag.current;
    drag.current = undefined;
    setLineWidth(undefined);
    if (start?.moved !== true) return;
    onWidthChange(keep, true);
  };
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
    drag.current = { pointerId: event.pointerId, x: event.clientX, width, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === undefined || start.pointerId !== event.pointerId) return;
    // A move with no button pressed means the release went elsewhere: nothing is kept.
    if (event.buttons === 0) {
      endDrag(undefined);
      return;
    }
    if (!start.moved && Math.abs(event.clientX - start.x) < dragThresholdPx) return;
    start.moved = true;
    const next = clamp(start.width + event.clientX - start.x);
    if (preview === 'line') setLineWidth(next);
    else onWidthChange(next, false);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start === undefined || start.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    // A click without a drag shows the buttons instead.
    if (!start.moved && Math.abs(event.clientX - start.x) < dragThresholdPx) {
      drag.current = undefined;
      setStepping(true);
      return;
    }
    start.moved = true;
    endDrag(clamp(start.width + event.clientX - start.x));
  };
  // A capture lost without a pointerup, as when the window loses focus, keeps nothing.
  const onPointerLost = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) endDrag(undefined);
  };
  // The buttons take focus when they show, so leaving them closes them.
  const wider = useCallback((node: HTMLButtonElement | null) => node?.focus(), []);
  const handle = useRef<HTMLDivElement | null>(null);
  const onStepperBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setStepping(false);
  };
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: an hr cannot take focus or the arrow keys; a resize handle is a focusable separator. */}
      <div
        role="separator"
        aria-label={`Resize the ${column} column`}
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuetext={`${width} px`}
        aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
        tabIndex={focusable ? 0 : -1}
        data-column-resizer
        ref={handle}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerLost}
        onLostPointerCapture={onPointerLost}
        // A click on the handle is not a click on the header's sort button or the board's row.
        onClick={(event) => event.stopPropagation()}
        className="group absolute inset-y-0 end-0 z-10 flex w-(--nm-target-min) cursor-col-resize touch-none justify-end outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span
          aria-hidden
          className="h-full w-0.5 group-hover:bg-ring group-focus-visible:bg-ring group-active:bg-ring"
        />
        {lineWidth !== undefined && (
          // Where the edge goes on release, down the grid, which clips it.
          <span
            aria-hidden
            data-column-resize-line
            className="pointer-events-none absolute top-0 h-screen w-0.5 bg-ring"
            style={{ left: `calc(100% + ${lineWidth - width - 2}px)` }}
          />
        )}
      </div>
      {stepping && (
        // biome-ignore lint/a11y/useSemanticElements: two buttons beside a header, not a form part with a legend.
        <div
          role="group"
          aria-label={`${column} column width`}
          data-column-stepper
          onBlur={onStepperBlur}
          // A press keeps focus on the button that has it: a browser that does not focus a clicked
          // button, as Safari, would otherwise blur the group and close it before the click.
          onMouseDown={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setStepping(false);
            handle.current?.focus();
          }}
          className="absolute inset-y-0 end-(--nm-target-min) z-20 flex items-center gap-0.5 bg-muted ps-0.5"
        >
          <IconButton
            label={`Narrow the ${column} column`}
            size="icon-sm"
            variant="outline"
            className="aria-disabled:opacity-50"
            tabIndex={-1}
            // Not disabled, which would drop the focus the Escape key needs.
            aria-disabled={width <= minWidth}
            onClick={(event) => {
              event.stopPropagation();
              if (width > minWidth) onWidthChange(clamp(width - buttonStepPx), true);
            }}
          >
            <Minus aria-hidden />
          </IconButton>
          <IconButton
            ref={wider}
            label={`Widen the ${column} column`}
            size="icon-sm"
            variant="outline"
            className="aria-disabled:opacity-50"
            tabIndex={-1}
            aria-disabled={width >= maxWidth}
            onClick={(event) => {
              event.stopPropagation();
              if (width < maxWidth) onWidthChange(clamp(width + buttonStepPx), true);
            }}
          >
            <Plus aria-hidden />
          </IconButton>
        </div>
      )}
    </>
  );
}
