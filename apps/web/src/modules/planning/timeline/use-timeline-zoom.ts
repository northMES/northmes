// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The zoom of the board and the Gantt (ADR 0089, Zoom levels): the range extension a level change
// asks for, and the steps of Ctrl+wheel, the minus and plus keys, the toolbar and Zoom to fit,
// each of which keeps its anchor instant at its x.
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { announce } from '../../../ui/lib/announce.ts';
import type { ZoomLevel } from '../gantt-data.ts';
import {
  plantDateOf,
  steppedLevel,
  type TimeRange,
  type TimeScale,
  zoomLevels,
} from './time-scale.ts';
import {
  anchorAt,
  anchoredScrollLeft,
  centreAnchor,
  createPinchZoom,
  createWheelZoom,
  fitView,
  type GridLayout,
  rangeAround,
  type ViewAnchor,
  type ZoomPlant,
} from './zoom-view.ts';

/** Whole spans of the level added before and after the chosen range. */
export interface Extension {
  readonly before: number;
  readonly after: number;
}

interface KeyedExtension extends Extension {
  /** The chosen start and level the extension belongs to, "2026-11-02|week". */
  readonly key: string;
}

/** The extension of the range in view, and the one a level change waits to show. */
interface ExtensionState {
  readonly current: KeyedExtension;
  readonly next?: KeyedExtension;
}

export interface RangeExtension {
  readonly key: string;
  readonly extension: Extension;
  /** Grows the extension of the range in view, as the Gantt does at an edge (#685). */
  readonly setExtension: (update: (current: Extension) => Extension) => void;
  /** The extension the range of a start and level takes once the URL names them. */
  readonly expect: (next: KeyedExtension) => void;
}

/**
 * The extension of the range of a start and a level: none for a new start or level, as React's
 * rule for state derived from props says, unless a level change asked for one.
 */
export function useRangeExtension(from: string, zoom: ZoomLevel): RangeExtension {
  const key = `${from}|${zoom}`;
  const [state, setState] = useState<ExtensionState>({ current: { key, before: 0, after: 0 } });
  let current = state.current;
  if (current.key !== key) {
    current = state.next?.key === key ? state.next : { key, before: 0, after: 0 };
    setState({ current });
  }
  const setExtension = useCallback(
    (update: (current: Extension) => Extension) =>
      setState((previous) => {
        const base = previous.current.key === key ? previous.current : { before: 0, after: 0 };
        return { ...previous, current: { key, ...update(base) } };
      }),
    [key],
  );
  const expect = useCallback(
    (next: KeyedExtension) =>
      setState((previous) =>
        next.key === previous.current.key ? { current: next } : { ...previous, next },
      ),
    [],
  );
  return { key, extension: current, setExtension, expect };
}

export interface TimelineZoomInput {
  readonly zoom: ZoomLevel;
  readonly range: RangeExtension;
  readonly scale: TimeScale;
  /** The grid that scrolls the time area sideways. */
  readonly grid: RefObject<HTMLElement | null>;
  /** Where the time column starts in the grid, and how much of it the sticky columns cover. */
  readonly columns: Omit<GridLayout, 'clientWidth'>;
  readonly plant: ZoomPlant;
  /** Puts the level and the chosen start in the URL. */
  readonly onNavigate: (zoom: ZoomLevel, from: string) => void;
  /** Called with the scroll position the zoom set, the screen's new baseline for its edges. */
  readonly onScrolled?: (scrollLeft: number) => void;
  /**
   * Whether a pointer drag is in progress: it reads its moves in pixels of the level it began at,
   * so no gesture or key steps a level until it ends.
   */
  readonly dragging?: () => boolean;
}

export interface TimelineZoom {
  /** A level from the toolbar, around the centre of the view. */
  readonly setLevel: (zoom: ZoomLevel) => void;
  /** Zoom to fit a span, or nothing when there is none. */
  readonly fit: (span: TimeRange | undefined, name: string) => void;
  /** Minus and plus with focus in the grid; true when the key was a zoom key. */
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean;
  /** Now: the level kept, now at the centre of the view, the range rebuilt around it. */
  readonly goTo: (ms: number) => void;
}

/**
 * The zoom actions of a timeline. A level change asks for the range of the new level around its
 * anchor, puts the level and start in the URL, and once that range is laid out scrolls the grid
 * so the anchor instant is back at its x. Ctrl+wheel and Cmd+wheel over the time area step a level
 * per gesture at the pointer and keep the page from zooming; over the tree columns the browser
 * zooms as usual.
 */
export function useTimelineZoom(input: TimelineZoomInput): TimelineZoom {
  const { zoom, range, scale, grid, columns, plant, onNavigate, onScrolled, dragging } = input;
  // The grid's width is read when the planner zooms, so it is the width the anchor was taken in.
  const layoutOf = (element: HTMLElement | null): GridLayout => ({
    clientWidth: element?.clientWidth ?? 0,
    ...columns,
  });
  const pending = useRef<{ readonly key: string; readonly anchor: ViewAnchor } | undefined>(
    undefined,
  );

  const scrollTo = useCallback(
    (left: number) => {
      const element = grid.current;
      if (element === null) return;
      element.scrollLeft = left;
      // The browser clamps the position on assignment, so the read is where the view is.
      onScrolled?.(element.scrollLeft);
    },
    [grid, onScrolled],
  );

  /**
   * Zooms to a level around an anchor, and says the new level, or the message given. With no grid
   * laid out (an empty, loading or failed page), the level and the start go to the URL alone: the
   * start the caller names, else the start in view.
   */
  const zoomTo = (level: ZoomLevel, anchor: ViewAnchor, message?: string, start?: string) => {
    const say = () => {
      if (message !== undefined) announce(message);
      else if (level !== zoom) announce(`Zoom level ${zoomLevels[level].label}`);
    };
    if (grid.current === null || grid.current.clientWidth === 0) {
      onNavigate(level, start ?? range.key.slice(0, range.key.indexOf('|')));
      say();
      return;
    }
    const layout = layoutOf(grid.current);
    const next = rangeAround(anchor, layout, level, plant);
    const key = `${next.from}|${level}`;
    const held =
      key === range.key &&
      next.extension.before <= range.extension.before &&
      next.extension.after <= range.extension.after;
    if (held) {
      scrollTo(anchoredScrollLeft(scale, anchor, layout));
    } else {
      pending.current = { key, anchor };
      range.expect({ key, ...next.extension });
      if (key !== range.key) onNavigate(level, next.from);
    }
    say();
  };

  // Once the range of the new level is laid out, the anchor goes back to its x.
  useLayoutEffect(() => {
    const target = pending.current;
    if (target === undefined || target.key !== range.key) return;
    pending.current = undefined;
    scrollTo(anchoredScrollLeft(scale, target.anchor, layoutOf(grid.current)));
  });

  /** Steps a level around an anchor; at an end of the ladder, says so when `sayEnd` asks. */
  const stepAt = (direction: 'in' | 'out', anchor: ViewAnchor, sayEnd = false) => {
    if (dragging?.() === true) return;
    const level = steppedLevel(zoom, direction);
    if (level !== zoom) zoomTo(level, anchor);
    else if (sayEnd) {
      announce(
        `${zoomLevels[zoom].label} is the ${direction === 'out' ? 'coarsest' : 'finest'} zoom level`,
      );
    }
  };
  const centre = () => centreAnchor(scale, grid.current?.scrollLeft ?? 0, layoutOf(grid.current));
  /**
   * Where a key zooms: at the left edge of the focused block or cluster, so it stays where it was
   * and in view (WCAG 2.4.11), else around the centre of the view.
   */
  const keyAnchor = (target: EventTarget): ViewAnchor => {
    const element = grid.current;
    const item =
      target instanceof Element
        ? target.closest('[data-block], [data-job-order], [data-cluster]')
        : null;
    if (element === null || item === null) return centre();
    const layout = layoutOf(element);
    const viewportX =
      item.getBoundingClientRect().left - element.getBoundingClientRect().left - element.clientLeft;
    const start = timeAreaStart(layout, element.scrollLeft);
    if (viewportX < start || viewportX >= layout.clientWidth) return centre();
    return anchorAt(scale, element.scrollLeft, layout, viewportX);
  };

  // The listeners are attached once and read the latest view through a ref, so a gesture keeps
  // its state across the renders its own step causes.
  const latest = useRef({ stepAt, scale, layoutOf });
  useLayoutEffect(() => {
    latest.current = { stepAt, scale, layoutOf };
  });
  // Built once, so a gesture keeps its state across the renders its own step causes.
  const [listeners] = useState(() => gestureListeners(latest));
  // Attached to the grid in view, again when the grid changes (the page's states draw it anew),
  // and removed on unmount.
  // The wheel and Safari's gesture listeners are not passive, so preventDefault keeps the page
  // from zooming; touch-action on the grid already does that for touches, so a one-finger scroll
  // never waits for the touch listeners.
  useEffect(() => {
    const element = grid.current;
    const active = { passive: false };
    const passive = { passive: true };
    element?.addEventListener('wheel', listeners.wheel, active);
    element?.addEventListener('touchstart', listeners.touchstart, passive);
    element?.addEventListener('touchmove', listeners.touchmove, passive);
    element?.addEventListener('touchend', listeners.touchend, passive);
    element?.addEventListener('gesturestart', listeners.gesturestart, active);
    element?.addEventListener('gesturechange', listeners.gesturechange, active);
    return () => {
      element?.removeEventListener('wheel', listeners.wheel);
      element?.removeEventListener('touchstart', listeners.touchstart);
      element?.removeEventListener('touchmove', listeners.touchmove);
      element?.removeEventListener('touchend', listeners.touchend);
      element?.removeEventListener('gesturestart', listeners.gesturestart);
      element?.removeEventListener('gesturechange', listeners.gesturechange);
    };
  });

  return {
    setLevel: (level) => {
      if (level !== zoom) zoomTo(level, centre());
    },
    fit: (span, name) => {
      // With no rows drawn there is nothing to fit, nor a view to fit it in.
      if (span === undefined || grid.current === null || grid.current.clientWidth === 0) {
        announce('Nothing to fit');
        return;
      }
      const fitted = fitView(span, layoutOf(grid.current), plant);
      zoomTo(
        fitted.zoom,
        fitted.anchor,
        `Zoomed to fit ${name}, zoom level ${zoomLevels[fitted.zoom].label}`,
      );
    },
    onKeyDown: (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      // Plus is "=" without Shift on many layouts, as the browser's own zoom keys read it.
      const direction =
        event.key === '-' ? 'out' : event.key === '+' || event.key === '=' ? 'in' : undefined;
      if (direction === undefined) return false;
      // A held key steps once, so it never runs through the ladder.
      if (!event.repeat) stepAt(direction, keyAnchor(event.target), true);
      return true;
    },
    goTo: (ms) => {
      const layout = layoutOf(grid.current);
      zoomTo(
        zoom,
        { ms, viewportX: centreAnchor(scale, 0, layout).viewportX },
        undefined,
        plantDateOf(ms, plant.timeZone),
      );
    },
  };
}

/** The listener of each gesture event the grid takes. */
interface GestureListeners {
  readonly wheel: (event: Event) => void;
  readonly touchstart: (event: Event) => void;
  readonly touchmove: (event: Event) => void;
  readonly touchend: (event: Event) => void;
  readonly gesturestart: (event: Event) => void;
  readonly gesturechange: (event: Event) => void;
}

/**
 * Where the time area starts in the grid's viewport: after the sticky columns, or after every tree
 * column while the columns that do not stick are still in view.
 */
function timeAreaStart(layout: GridLayout, scrollLeft: number): number {
  return Math.max(layout.stickyWidth, layout.treeWidth - scrollLeft);
}

interface LatestView {
  readonly stepAt: (direction: 'in' | 'out', anchor: ViewAnchor) => void;
  readonly scale: TimeScale;
  readonly layoutOf: (element: HTMLElement | null) => GridLayout;
}

/** Safari's GestureEvent, which the DOM types do not know. */
interface GestureLike extends UIEvent {
  readonly scale: number;
  readonly clientX: number;
}

/**
 * The listeners that zoom the timeline by gesture (ADR 0089): Ctrl+wheel and Cmd+wheel, which is
 * also how Chrome, Edge and Firefox report a trackpad pinch, over the time area; a two-finger pinch
 * on a touchscreen over the grid; and Safari's own gesture events for a trackpad pinch. Each
 * keeps the page from zooming over the time area and steps one level per gesture, anchored at the
 * pointer or between the fingers.
 */
function gestureListeners(latest: RefObject<LatestView>): GestureListeners {
  const wheel = createWheelZoom();
  const pinch = createPinchZoom();
  let startDistance = 0;
  // Whether Safari's trackpad pinch began over the time area, which it then zooms.
  let gestureOverTime = false;
  /** The viewport x of a client x in the grid, and whether it lies over the time area. */
  const viewportOf = (element: HTMLElement, clientX: number) => {
    const layout = latest.current.layoutOf(element);
    const viewportX = clientX - element.getBoundingClientRect().left - element.clientLeft;
    const start = timeAreaStart(layout, element.scrollLeft);
    return { layout, viewportX, start, overTime: viewportX >= start };
  };
  const step = (element: HTMLElement, direction: 'in' | 'out' | undefined, clientX: number) => {
    if (direction === undefined) return;
    const { layout, viewportX, start } = viewportOf(element, clientX);
    // A pinch that started over the tree columns zooms around the time area's first pixel.
    const x = Math.max(start, Math.min(layout.clientWidth, viewportX));
    const view = latest.current;
    view.stepAt(direction, anchorAt(view.scale, element.scrollLeft, layout, x));
  };
  const twoTouches = (event: TouchEvent) => {
    const [first, second] = [event.touches[0], event.touches[1]];
    if (first === undefined || second === undefined || event.touches.length !== 2) return undefined;
    return {
      distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
      clientX: (first.clientX + second.clientX) / 2,
    };
  };
  return {
    wheel: (event: Event) => {
      const wheelEvent = event as WheelEvent;
      if (!wheelEvent.ctrlKey && !wheelEvent.metaKey) return;
      const element = event.currentTarget as HTMLElement;
      if (!viewportOf(element, wheelEvent.clientX).overTime) return;
      event.preventDefault();
      step(element, wheel(wheelEvent.deltaY, event.timeStamp), wheelEvent.clientX);
    },
    touchstart: (event: Event) => {
      const touches = twoTouches(event as TouchEvent);
      if (touches === undefined) return;
      startDistance = touches.distance;
      pinch.start();
    },
    touchmove: (event: Event) => {
      const touches = twoTouches(event as TouchEvent);
      if (touches === undefined || startDistance === 0) return;
      step(
        event.currentTarget as HTMLElement,
        pinch.move(touches.distance / startDistance),
        touches.clientX,
      );
    },
    touchend: (event: Event) => {
      if ((event as TouchEvent).touches.length < 2) startDistance = 0;
    },
    gesturestart: (event: Event) => {
      const element = event.currentTarget as HTMLElement;
      gestureOverTime = viewportOf(element, (event as GestureLike).clientX).overTime;
      if (!gestureOverTime) return;
      event.preventDefault();
      // On iOS the touches lead the same pinch; Safari's gesture only leads on a trackpad.
      if (startDistance === 0) pinch.start();
    },
    gesturechange: (event: Event) => {
      if (!gestureOverTime) return;
      event.preventDefault();
      if (startDistance !== 0) return;
      const gesture = event as GestureLike;
      step(event.currentTarget as HTMLElement, pinch.move(gesture.scale), gesture.clientX);
    },
  };
}
