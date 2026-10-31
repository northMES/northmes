// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The zoom of the board and the Gantt (ADR 0089, Zoom levels): the steps of Ctrl+wheel, the minus
// and plus keys, the toolbar and Zoom to fit, each of which rebuilds the buffer of the endless
// axis around its anchor instant at its x.
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { announce } from '../../../ui/lib/announce.ts';
import type { ZoomLevel } from '../gantt-data.ts';
import { steppedLevel, type TimeRange, type TimeScale, zoomLevels } from './time-scale.ts';
import type { TimeBuffer } from './use-time-buffer.ts';
import {
  anchorAt,
  centreAnchor,
  createPinchZoom,
  createWheelZoom,
  fitView,
  type GridLayout,
  type ViewAnchor,
  type ZoomPlant,
} from './zoom-view.ts';

export interface TimelineZoomInput {
  /** The buffer of the endless axis, which a level change rebuilds. */
  readonly buffer: TimeBuffer;
  /** The grid that scrolls the time area sideways. */
  readonly grid: RefObject<HTMLElement | null>;
  readonly plant: ZoomPlant;
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
  /** Now: the level kept, now at the centre of the view, the buffer rebuilt around it. */
  readonly goTo: (ms: number) => void;
}

/**
 * The zoom actions of a timeline. A level change rebuilds the buffer of the new level around its
 * anchor, which scrolls the grid so the anchor instant stays at its x, and the level and the
 * visible start go to the URL. Ctrl+wheel and Cmd+wheel over the time area step a level per
 * gesture at the pointer and keep the page from zooming; over the tree columns the browser zooms
 * as usual.
 */
export function useTimelineZoom(input: TimelineZoomInput): TimelineZoom {
  const { buffer, grid, plant, dragging } = input;
  const zoom = buffer.zoom;
  const scale = buffer.scale;
  const layoutOf = (): GridLayout => buffer.layout;

  /** Zooms to a level around an anchor, and says the new level, or the message given. */
  const zoomTo = (level: ZoomLevel, anchor: ViewAnchor, message?: string) => {
    buffer.goTo(level, anchor);
    if (message !== undefined) announce(message);
    else if (level !== zoom) announce(`Zoom level ${zoomLevels[level].label}`);
  };

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
  /**
   * The anchor at the centre of the view, also while no grid is drawn, or the start in view while
   * the time area has no width.
   */
  const centre = (): ViewAnchor =>
    scale === undefined
      ? { ms: buffer.visible.get()?.fromMs ?? Date.now(), viewportX: buffer.layout.stickyWidth }
      : centreAnchor(scale, buffer.scrollLeft(), layoutOf());
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
    if (element === null || item === null || scale === undefined) return centre();
    const layout = layoutOf();
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
      if (span === undefined || buffer.range === undefined) {
        announce('Nothing to fit');
        return;
      }
      const fitted = fitView(span, layoutOf(), plant);
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
      const { clientWidth, stickyWidth } = layoutOf();
      zoomTo(zoom, { ms, viewportX: stickyWidth + (clientWidth - stickyWidth) / 2 });
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
  readonly scale: TimeScale | undefined;
  readonly layoutOf: () => GridLayout;
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
    const layout = latest.current.layoutOf();
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
    if (view.scale === undefined) return;
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
