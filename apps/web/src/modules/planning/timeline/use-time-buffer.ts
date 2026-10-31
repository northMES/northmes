// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The endless axis of the board and the Gantt (ADR 0089): the buffer the view draws, its move near
// an edge with the scroll position corrected before the browser paints, the span in view for the
// toolbar's range text, and the visible start that goes to the URL when scrolling stops.
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { flushSync } from 'react-dom';
import type { ZoomLevel } from '../gantt-data.ts';
import { fromAt, startOfFrom } from '../gantt-search.ts';
import {
  bufferAround,
  bufferScale,
  instantAtDistance,
  movedBuffer,
  visibleSpan,
} from './time-buffer.ts';
import {
  bandOf,
  plantDateOf,
  roundZoom,
  type TimeRange,
  type TimeScale,
  type Zoom,
} from './time-scale.ts';
import {
  anchoredScrollLeft,
  type GridLayout,
  type ViewAnchor,
  type ZoomPlant,
} from './zoom-view.ts';

/** How long the scroll rests before the view counts it as stopped and writes `from`. */
const settleMs = 150;

/** How many of its own writes the view recognises when the URL delivers them late. */
const keptWrites = 8;

/** The span in view, which changes on every scroll event, for the few parts that show it live. */
export interface VisibleStore {
  readonly get: () => TimeRange | undefined;
  readonly subscribe: (listener: () => void) => () => void;
}

function createVisibleStore(): VisibleStore & { readonly set: (span: TimeRange) => void } {
  let span: TimeRange | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => span,
    set: (next) => {
      if (span !== undefined && span.fromMs === next.fromMs && span.toMs === next.toMs) return;
      span = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The span in view, read live, so a scroll redraws only the component that reads it. */
export function useVisibleSpan(store: VisibleStore): TimeRange | undefined {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export interface TimeBufferInput {
  /** The width per hour in the URL (ADR 0090, The URL key zoom). */
  readonly zoom: number;
  /** The visible start in the URL, a plant date or date-time. */
  readonly from: string | undefined;
  /** Now, whose plant date the view opens at when the URL names no start. */
  readonly nowMs: number;
  /** The grid's width; the visible time area is this less the sticky columns. */
  readonly widthPx: number;
  readonly grid: RefObject<HTMLElement | null>;
  /** Where the time column starts in the grid, and how much of it the sticky columns cover. */
  readonly columns: Omit<GridLayout, 'clientWidth'>;
  readonly plant: ZoomPlant;
  /** Writes the width per hour, to three significant digits, and the visible start to the URL. */
  readonly onNavigate: (zoom: number, from: string) => void;
  /**
   * A pointer drag in progress, which holds the buffer where it is, since the drag reads its moves
   * in this buffer's pixels; when it ends, the view checks the edges as a scroll there would.
   */
  readonly frozen?: {
    readonly get: () => boolean;
    readonly subscribe: (listener: () => void) => () => void;
  };
}

export interface TimeBuffer {
  /** The band the buffer is drawn in. */
  readonly zoom: ZoomLevel;
  /** The width per hour the buffer is drawn at, which the URL follows once scrolling stops. */
  readonly pxPerHour: number;
  /**
   * Whether a zoom gesture or animation is under way: chunk loads, drops and the URL wait for its
   * end (ADR 0090, Laying out a zoom).
   */
  readonly zooming: boolean;
  /** The buffer's span, or none while the time area has no width. */
  readonly range: TimeRange | undefined;
  readonly scale: TimeScale | undefined;
  /** The grid across, as the zoom reads it. */
  readonly layout: GridLayout;
  /** The span in view, live. */
  readonly visible: VisibleStore;
  /** The span in view when scrolling last stopped, which names the grid. */
  readonly settled: TimeRange | undefined;
  /** The grid's scroll listener. */
  readonly onScroll: () => void;
  /**
   * Builds the buffer of a zoom around an instant at a viewport x, and writes the URL once
   * scrolling stops; `during` marks a frame of a gesture or an animation, whose end comes after.
   */
  readonly goTo: (zoom: Zoom, anchor: ViewAnchor, during?: boolean) => void;
  /** Earlier and Later: the view one viewport width before or after where it is. */
  readonly page: (direction: 'earlier' | 'later') => void;
  /** The x in the buffer where the view starts. */
  readonly viewStartX: () => number;
  /** The grid's scroll position, or the one it takes once it is drawn. */
  readonly scrollLeft: () => number;
}

interface BufferState {
  readonly zoom: Zoom;
  /** Whether the buffer is a frame of a zoom gesture or animation. */
  readonly zooming: boolean;
  readonly range: TimeRange;
  /** The URL and plant clock the buffer agrees with: zoom, start, zone and production day start. */
  readonly seen: string;
  /**
   * What the view last wrote to the URL, newest last, so the URL catching up rebuilds nothing, also
   * when the router delivers an older write after a newer one.
   */
  readonly written: readonly string[];
  readonly viewportPx: number;
  readonly closedOf: ZoomPlant['closedOf'];
  /** The anchor a new buffer scrolls to once it is laid out, and whether the URL follows. */
  readonly pending?: { readonly anchor: ViewAnchor; readonly write: boolean };
}

/** The zoom of a key of what a buffer agrees with. */
function zoomKeyOf(seen: string): string {
  return seen.slice(0, seen.indexOf('|'));
}

/** The key of what a buffer agrees with in the URL and the plant clock. */
function seenKey(pxPerHour: number, start: string, plant: ZoomPlant): string {
  return `${roundZoom(pxPerHour)}|${start}|${plant.timeZone}|${plant.productionDayStart}`;
}

/**
 * The buffer of the endless axis. It is built around the URL's start (or now's date) with the
 * start at the view's left edge and two viewport widths around the view, rebuilt when the URL or
 * the plant clock change from outside and when the width or Hide closed time change, and moved by
 * one viewport width when the view comes within a quarter width of an edge. A move renders at once
 * inside the scroll event and corrects the scroll position before paint, so the instant at the
 * view's start stays where it was.
 */
export function useTimeBuffer(input: TimeBufferInput): TimeBuffer {
  const { zoom, from, nowMs, widthPx, grid, columns, plant, onNavigate, frozen } = input;
  const { treeWidth, stickyWidth } = columns;
  const { timeZone, productionDayStart, closedOf } = plant;
  const viewportPx = Math.max(0, widthPx - stickyWidth);
  const layout = useMemo<GridLayout>(
    () => ({ clientWidth: widthPx, treeWidth, stickyWidth }),
    [widthPx, treeWidth, stickyWidth],
  );
  const urlStart = from ?? plantDateOf(nowMs, timeZone);
  const seen = seenKey(zoom, urlStart, plant);
  const [visible] = useState(createVisibleStore);
  const [settled, setSettled] = useState<TimeRange | undefined>(undefined);

  /** The buffer of a zoom with an anchor at its viewport x and the view one width inside it. */
  const build = (
    level: Zoom,
    anchor: ViewAnchor,
    agreed: { readonly seen: string; readonly written: readonly string[] },
    write = false,
    zooming = false,
  ): BufferState => ({
    zoom: level,
    zooming,
    range: bufferAround({
      anchorMs: anchor.ms,
      anchorX: viewportPx + anchor.viewportX - stickyWidth,
      viewportPx,
      zoom: level,
      plant,
    }),
    ...agreed,
    viewportPx,
    closedOf,
    pending: { anchor, write },
  });

  const [state, setState] = useState<BufferState | undefined>(undefined);
  let current = state;
  // State derived from the URL and the plant, as React's rule for state from props says: a change
  // from outside rebuilds the buffer around the URL's start, the URL catching up with what the
  // view wrote rebuilds nothing, and a change of width or of Hide closed time rebuilds around the
  // start in view.
  if (viewportPx > 0) {
    if (current === undefined || (current.seen !== seen && !current.written.includes(seen))) {
      const anchor = {
        ms: startOfFrom(urlStart, bandOf(zoom), timeZone, productionDayStart),
        viewportX: stickyWidth,
      };
      current = build({ band: bandOf(zoom), pxPerHour: zoom }, anchor, { seen, written: [] });
      setState(current);
    } else if (current.seen !== seen) {
      // Once the URL holds the newest write, the older ones are history: Back to one of them is a
      // change from outside.
      const newest = current.written[current.written.length - 1];
      current = { ...current, seen, written: seen === newest ? [] : current.written };
      setState(current);
    } else if (current.viewportPx !== viewportPx || current.closedOf !== closedOf) {
      const anchor = { ms: visible.get()?.fromMs ?? current.range.fromMs, viewportX: stickyWidth };
      current = build(current.zoom, anchor, { seen: current.seen, written: current.written });
      setState(current);
    }
  }

  // A hidden time area keeps no buffer until it shows (ADR 0089).
  const shown = viewportPx > 0 ? current : undefined;
  const range = shown?.range;
  const level = shown?.zoom;
  const scale = useMemo(
    () =>
      range === undefined || level === undefined
        ? undefined
        : bufferScale(range, level, { timeZone, productionDayStart, closedOf }),
    [range, level, timeZone, productionDayStart, closedOf],
  );

  // The scroll position of the view: where a new buffer put it and the planner scrolled it since.
  // It is where the view starts while no grid is drawn, as on an empty or a loading page, and
  // where a grid drawn again scrolls to.
  const intendedLeft = useRef(0);
  const scrollLeft = useCallback(() => grid.current?.scrollLeft ?? intendedLeft.current, [grid]);
  const viewStartX = useCallback(
    () => Math.max(0, scrollLeft() + stickyWidth - treeWidth),
    [scrollLeft, stickyWidth, treeWidth],
  );

  // The latest values for the listeners and the timer, which outlive the render they were made in.
  // Where the URL's start opens, to the minute, so a view that rests there writes nothing.
  const urlStartAt = fromAt(
    startOfFrom(urlStart, bandOf(zoom), timeZone, productionDayStart),
    timeZone,
  );
  const latest = useRef({
    scale,
    current,
    viewportPx,
    plant,
    onNavigate,
    frozen,
    viewStartX,
    urlStartAt,
  });
  useLayoutEffect(() => {
    latest.current = {
      scale,
      current,
      viewportPx,
      plant,
      onNavigate,
      frozen,
      viewStartX,
      urlStartAt,
    };
  });

  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Once scrolling has rested, the span in view names the grid, and its start goes to the URL. */
  const settle = useCallback(() => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const view = latest.current;
      // A drag or a zoom gesture under way writes once it ends.
      if (view.frozen?.get() === true || view.current?.zooming === true) {
        settle();
        return;
      }
      const span = visible.get();
      const buffer = view.current;
      if (span === undefined || buffer === undefined) return;
      setSettled(span);
      const start = fromAt(span.fromMs, view.plant.timeZone);
      const key = seenKey(buffer.zoom.pxPerHour, start, view.plant);
      if (
        key === buffer.seen ||
        (zoomKeyOf(key) === zoomKeyOf(buffer.seen) && start === view.urlStartAt)
      ) {
        return;
      }
      setState((previous) =>
        previous === undefined
          ? previous
          : { ...previous, written: [...previous.written.slice(1 - keptWrites), key] },
      );
      view.onNavigate(roundZoom(buffer.zoom.pxPerHour), start);
    }, settleMs);
  }, [visible]);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // A new buffer scrolls to the anchor it was built for before the browser paints, once: a state
  // that only records what the URL says keeps the anchor, which must not scroll the view back.
  // A grid drawn again, as after an empty, a loading or a failed page, scrolls to where the view
  // is.
  const applied = useRef<BufferState['pending']>(undefined);
  const scrolledGrid = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = grid.current;
    if (state?.pending !== undefined && scale !== undefined && applied.current !== state.pending) {
      applied.current = state.pending;
      intendedLeft.current = anchoredScrollLeft(scale, state.pending.anchor, layout);
      if (element !== null) element.scrollLeft = intendedLeft.current;
      scrolledGrid.current = element;
      const span = visibleSpan(scale, viewStartX(), viewportPx);
      visible.set(span);
      // A buffer built from the URL names the grid at once; one the planner moved writes the URL
      // once scrolling stops.
      if (state.pending.write) settle();
      else setSettled(span);
    } else if (element !== null && element !== scrolledGrid.current) {
      element.scrollLeft = intendedLeft.current;
      scrolledGrid.current = element;
    }
  });

  const onScroll = useCallback(() => {
    const view = latest.current;
    if (view.scale === undefined || view.current === undefined) return;
    intendedLeft.current = grid.current?.scrollLeft ?? intendedLeft.current;
    const startX = view.viewStartX();
    visible.set(visibleSpan(view.scale, startX, view.viewportPx));
    const moved =
      view.frozen?.get() === true
        ? undefined
        : movedBuffer({
            scale: view.scale,
            viewStartX: startX,
            viewportPx: view.viewportPx,
            plant: view.plant,
          });
    if (moved !== undefined) {
      const pending = { anchor: { ms: moved.anchorMs, viewportX: stickyWidth }, write: true };
      // The move renders inside the scroll event, so the corrected position is what paints. It
      // updates the state it is given, so a write the timer queued is kept.
      flushSync(() =>
        setState((previous) =>
          previous === undefined ? previous : { ...previous, range: moved.range, pending },
        ),
      );
      return;
    }
    settle();
  }, [settle, stickyWidth, grid]);

  // The end of a pointer drag checks the edges, as a scroll to where the drag left the view would.
  useEffect(() => {
    let dragging = latest.current.frozen?.get() === true;
    return latest.current.frozen?.subscribe(() => {
      const now = latest.current.frozen?.get() === true;
      if (dragging && !now) onScroll();
      dragging = now;
    });
  }, [onScroll]);

  const goTo = (target: Zoom, anchor: ViewAnchor, during = false) => {
    if (viewportPx <= 0 || current === undefined) {
      // No time area to lay out: the zoom and the anchor's date go to the URL alone, at the end,
      // and a gesture that a frame began ends.
      if (during) return;
      if (current?.zooming === true) setState({ ...current, zooming: false });
      onNavigate(roundZoom(target.pxPerHour), plantDateOf(anchor.ms, timeZone));
      return;
    }
    setState(build(target, anchor, { seen: current.seen, written: current.written }, true, during));
  };

  /**
   * Earlier and Later: the buffer rebuilt around the instant one viewport width of drawn axis
   * before or after the view's start, wherever in the buffer the view is.
   */
  const page = (direction: 'earlier' | 'later') => {
    if (scale === undefined || current === undefined) return;
    const startMs = Math.round(scale.instant(viewStartX()));
    const ms = instantAtDistance(
      startMs,
      viewportPx,
      direction === 'earlier' ? 'before' : 'after',
      current.zoom,
      plant,
    );
    goTo(current.zoom, { ms, viewportX: stickyWidth });
  };

  return {
    zoom: current?.zoom.band ?? bandOf(zoom),
    pxPerHour: current?.zoom.pxPerHour ?? zoom,
    zooming: current?.zooming === true,
    range,
    scale,
    layout,
    visible,
    settled,
    onScroll,
    goTo,
    page,
    viewStartX,
    scrollLeft,
  };
}
