// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The smooth zoom of the board and the Gantt (ADR 0090, Gestures, buttons and keys): Ctrl+wheel,
// Cmd+wheel and a pinch zoom continuously, one change per animation frame; Zoom in, Zoom out and
// the plus and minus keys zoom by a factor of 2 over 150 ms; Zoom to fit fits a span band by band.
// Each frame rebuilds the buffer of the endless axis around its anchor instant at its x.
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
import {
  bandDuringGesture,
  bandOf,
  roundZoom,
  type TimeRange,
  type TimeScale,
  type Zoom,
  zoomClamp,
  zoomLevels,
  zoomOf,
} from './time-scale.ts';
import type { TimeBuffer } from './use-time-buffer.ts';
import {
  anchorAt,
  centreAnchor,
  fitView,
  type GridLayout,
  steppedZoom,
  type ViewAnchor,
  wheelFactor,
  type ZoomPlant,
  zoomedBy,
} from './zoom-view.ts';

export interface TimelineZoomInput {
  /** The buffer of the endless axis, which each frame of a zoom rebuilds. */
  readonly buffer: TimeBuffer;
  /** The grid that scrolls the time area sideways. */
  readonly grid: RefObject<HTMLElement | null>;
  /**
   * Up to two other elements over the time area, such as the Gantt's workload lanes: a gesture
   * over them zooms the timeline too, not the page.
   */
  readonly panels?: readonly RefObject<HTMLElement | null>[];
  readonly plant: ZoomPlant;
  /**
   * Whether a pointer drag is in progress: it reads its moves in pixels of the scale it began at,
   * so no gesture, button or key starts a zoom until it ends.
   */
  readonly dragging?: () => boolean;
}

export interface TimelineZoom {
  /** A level from the level menu, at its natural width, around the centre of the view. */
  readonly setLevel: (zoom: ZoomLevel) => void;
  /** Zoom in or Zoom out, around the centre of the view. */
  readonly step: (direction: 'in' | 'out') => void;
  /** Zoom to fit a span, or nothing when there is none. */
  readonly fit: (span: TimeRange | undefined, name: string) => void;
  /** Minus and plus with focus in the grid; true when the key was a zoom key. */
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean;
  /** Go to now: the zoom kept, now at the centre of the view, the buffer rebuilt around it. */
  readonly goTo: (ms: number) => void;
  /**
   * Ends a running zoom without a frame more, before something else moves the buffer, such as
   * Earlier, Later or Go to date.
   */
  readonly stop: () => void;
}

/** How long a gesture rests before it counts as ended, and how long a button's zoom takes. */
const gestureEndMs = 150;
const animationMs = 150;

/** An ease-out curve over [0, 1]. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Whether the planner asked for reduced motion, which makes a button's zoom immediate. */
function reducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * The zoom at the end of a gesture, an animation or Zoom to fit: the width to three significant
 * digits, as the URL holds it, in the band it lies in by the edges alone, so a reload opens the band
 * the planner saw (ADR 0090).
 */
function settledZoom(pxPerHour: number): Zoom {
  const rounded = roundZoom(pxPerHour);
  return { band: bandOf(rounded), pxPerHour: rounded };
}

/**
 * The zoom actions of a timeline. Each frame of a zoom rebuilds the buffer around its anchor,
 * which scrolls the grid so the anchor instant stays at its x; at the end of a gesture or an
 * animation the zoom and the visible start go to the URL, and the band is announced. Ctrl+wheel
 * and Cmd+wheel over the time area or a panel zoom at the pointer and keep the page from zooming;
 * over the tree columns the browser zooms as usual.
 */
export function useTimelineZoom(input: TimelineZoomInput): TimelineZoom {
  const { buffer, grid, panels, plant, dragging } = input;
  const scale = buffer.scale;
  const current: Zoom = { band: buffer.zoom, pxPerHour: buffer.pxPerHour };
  const layoutOf = (): GridLayout => buffer.layout;

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

  // The listeners and the animation outlive the render they were made in, so they read the latest
  // view through a ref and keep their state across the renders their own frames cause.
  const latest = useRef<LatestView>({
    buffer,
    current,
    scale,
    layoutOf,
    dragging,
    grid,
  });
  useLayoutEffect(() => {
    latest.current = { buffer, current, scale, layoutOf, dragging, grid };
  });
  const [motion] = useState(() => zoomMotion(latest));
  const [listeners] = useState(() => gestureListeners(latest, motion));
  useEffect(() => motion.stop, [motion]);
  // Attached to the grid and the panels in view, again when they change (the page's states draw
  // them anew), and removed on unmount.
  useGestureListeners(grid, listeners.grid);
  useGestureListeners(panels?.[0], listeners.panel);
  useGestureListeners(panels?.[1], listeners.panel);

  /** Zoom in or out by a factor of 2 around an anchor; at a clamp, says so when `sayEnd` asks. */
  const stepAt = (direction: 'in' | 'out', anchor: () => ViewAnchor, sayEnd = false) => {
    if (dragging?.() === true) return;
    const from = motion.target() ?? current.pxPerHour;
    const to = steppedZoom(from, direction);
    if (to === from) {
      if (sayEnd) {
        const end = direction === 'out' ? 'coarsest' : 'finest';
        announce(`${zoomLevels[bandOf(from)].label} is the ${end} zoom`);
      }
      return;
    }
    motion.animate(to, anchor);
  };

  return {
    setLevel: (level) => {
      if (dragging?.() === true) return;
      motion.stop();
      const zoom = zoomOf(level);
      buffer.goTo(zoom, centre());
      if (level !== current.band || zoom.pxPerHour !== current.pxPerHour) {
        announce(`Zoom: ${zoomLevels[level].label}`);
      }
    },
    step: (direction) => stepAt(direction, centre),
    fit: (span, name) => {
      // With no rows drawn there is nothing to fit, nor a view to fit it in.
      if (span === undefined || buffer.range === undefined) {
        announce('Nothing to fit');
        return;
      }
      motion.stop();
      const fitted = fitView(span, layoutOf(), plant);
      const zoom = settledZoom(fitted.zoom.pxPerHour);
      buffer.goTo(zoom, fitted.anchor);
      announce(`Zoomed to fit ${name}. Zoom: ${zoomLevels[zoom.band].label}`);
    },
    onKeyDown: (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      // Plus is "=" without Shift on many layouts, as the browser's own zoom keys read it.
      const direction =
        event.key === '-' ? 'out' : event.key === '+' || event.key === '=' ? 'in' : undefined;
      if (direction === undefined) return false;
      // A held key zooms once, so it never runs to the clamp.
      if (!event.repeat) {
        const target = event.target;
        stepAt(direction, () => keyAnchor(target), true);
      }
      return true;
    },
    goTo: (ms) => {
      motion.stop();
      const { clientWidth, stickyWidth } = layoutOf();
      buffer.goTo(settledZoom(current.pxPerHour), {
        ms,
        viewportX: stickyWidth + (clientWidth - stickyWidth) / 2,
      });
    },
    stop: motion.stop,
  };
}

/**
 * Where the time area starts in the grid's viewport: after the sticky columns, or after every tree
 * column while the columns that do not stick are still in view.
 */
function timeAreaStart(layout: GridLayout, scrollLeft: number): number {
  return Math.max(layout.stickyWidth, layout.treeWidth - scrollLeft);
}

interface LatestView {
  readonly buffer: TimeBuffer;
  /** The zoom drawn. */
  readonly current: Zoom;
  readonly scale: TimeScale | undefined;
  readonly layoutOf: () => GridLayout;
  readonly dragging: (() => boolean) | undefined;
  readonly grid: RefObject<HTMLElement | null>;
}

/** The frames of a zoom: a gesture's, coalesced to one per frame, and a button's animation. */
interface ZoomMotion {
  /** A gesture's change by a factor at a viewport x, applied at the next frame. */
  readonly gesture: (factor: number, viewportX: number) => void;
  /** An animation to a width per hour around an anchor, read once when it starts. */
  readonly animate: (pxPerHour: number, anchor: () => ViewAnchor) => void;
  /** The width a gesture or an animation runs to, which a press during it compounds from. */
  readonly target: () => number | undefined;
  /** Ends what runs without a frame more. */
  readonly stop: () => void;
}

/** The frame scheduler, which a page without requestAnimationFrame replaces by a timer. */
function nextFrame(callback: () => void): () => void {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    const id = globalThis.requestAnimationFrame(callback);
    return () => globalThis.cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 16);
  return () => clearTimeout(id);
}

/**
 * The frames of a zoom (ADR 0090). A gesture multiplies the zoom it holds by each event's factor
 * and lays the buffer out once per frame at the instant under the pointer; it ends 150 ms after
 * its last event, in the band the zoom lies in by the edges alone. An animation runs from the zoom
 * drawn to its target over 150 ms on an ease-out curve, immediate under reduced motion; a timer
 * ends it where frames do not run, as in a hidden tab. While a pointer drag runs, which reads the
 * scale it began at, no frame is laid out and the end waits for the drag to end.
 */
function zoomMotion(latest: RefObject<LatestView>): ZoomMotion {
  let gesture: { zoom: Zoom; viewportX: number } | undefined;
  let animation:
    | { from: number; to: number; anchor: ViewAnchor; startedAt: number; band: ZoomLevel }
    | undefined;
  let cancelFrame: (() => void) | undefined;
  let endTimer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    cancelFrame?.();
    cancelFrame = undefined;
    clearTimeout(endTimer);
    endTimer = undefined;
  };
  const anchorOfGesture = (viewportX: number): ViewAnchor | undefined => {
    const view = latest.current;
    const element = view.grid.current;
    if (view.scale === undefined) return undefined;
    return anchorAt(
      view.scale,
      element?.scrollLeft ?? view.buffer.scrollLeft(),
      view.layoutOf(),
      viewportX,
    );
  };
  const dragging = () => latest.current.dragging?.() === true;
  const finish = (pxPerHour: number, anchor: ViewAnchor | undefined, say = true) => {
    const view = latest.current;
    const zoom = settledZoom(pxPerHour);
    // Without a drawn time area, the start in view keeps its place, and the URL takes the zoom.
    view.buffer.goTo(
      zoom,
      anchor ?? {
        ms: view.buffer.visible.get()?.fromMs ?? Date.now(),
        viewportX: view.layoutOf().stickyWidth,
      },
    );
    if (say) announce(`Zoom: ${zoomLevels[zoom.band].label}`);
  };

  const gestureFrame = () => {
    cancelFrame = undefined;
    if (gesture === undefined || dragging()) return;
    const anchor = anchorOfGesture(gesture.viewportX);
    if (anchor !== undefined) latest.current.buffer.goTo(gesture.zoom, anchor, true);
  };
  const endGesture = (say = true) => {
    endTimer = undefined;
    if (dragging()) {
      endTimer = setTimeout(endGesture, gestureEndMs);
      return;
    }
    cancelFrame?.();
    cancelFrame = undefined;
    const ended = gesture;
    gesture = undefined;
    if (ended !== undefined) finish(ended.zoom.pxPerHour, anchorOfGesture(ended.viewportX), say);
  };

  const animationFrame = () => {
    cancelFrame = undefined;
    const running = animation;
    if (running === undefined) return;
    if (dragging()) {
      cancelFrame = nextFrame(animationFrame);
      return;
    }
    const t = Math.min(1, (performance.now() - running.startedAt) / animationMs);
    if (t >= 1) {
      endAnimation();
      return;
    }
    // A width per hour zooms evenly on a log scale, so the curve runs over the factor.
    const pxPerHour = running.from * (running.to / running.from) ** easeOut(t);
    running.band = bandDuringGesture(pxPerHour, running.band);
    latest.current.buffer.goTo({ band: running.band, pxPerHour }, running.anchor, true);
    cancelFrame = nextFrame(animationFrame);
  };
  const endAnimation = () => {
    if (dragging()) {
      clearTimeout(endTimer);
      endTimer = setTimeout(endAnimation, animationMs);
      return;
    }
    const running = animation;
    animation = undefined;
    cancel();
    if (running !== undefined) finish(running.to, running.anchor);
  };

  return {
    gesture: (factor, viewportX) => {
      if (animation !== undefined) {
        // A gesture takes over from an animation where it is.
        animation = undefined;
        cancel();
      }
      gesture = { zoom: zoomedBy(gesture?.zoom ?? latest.current.current, factor), viewportX };
      cancelFrame ??= nextFrame(gestureFrame);
      clearTimeout(endTimer);
      endTimer = setTimeout(endGesture, gestureEndMs);
    },
    animate: (pxPerHour, anchorOf) => {
      const view = latest.current;
      let from = view.current.pxPerHour;
      if (gesture !== undefined) {
        // A press ends the gesture where it is, and zooms on from there.
        from = roundZoom(gesture.zoom.pxPerHour);
        clearTimeout(endTimer);
        endGesture(false);
      }
      const anchor = animation?.anchor ?? anchorOf();
      if (reducedMotion()) {
        animation = undefined;
        cancel();
        finish(pxPerHour, anchor);
        return;
      }
      animation = {
        from: animation === undefined ? from : view.current.pxPerHour,
        to: pxPerHour,
        anchor,
        startedAt: performance.now(),
        band: animation?.band ?? view.current.band,
      };
      cancel();
      cancelFrame = nextFrame(animationFrame);
      endTimer = setTimeout(endAnimation, animationMs + 50);
    },
    target: () => animation?.to ?? gesture?.zoom.pxPerHour,
    stop: () => {
      gesture = undefined;
      animation = undefined;
      cancel();
    },
  };
}

/**
 * The gesture listeners on one element, attached after each render to the element in view and
 * removed before the next and on unmount. The wheel and Safari's gesture listeners are not
 * passive, so preventDefault keeps the page from zooming; touch-action on the grid already does
 * that for touches, so a one-finger scroll never waits for the touch listeners.
 */
function useGestureListeners(
  target: RefObject<HTMLElement | null> | undefined,
  own: GestureListeners,
): void {
  useEffect(() => {
    const element = target?.current;
    if (element === null || element === undefined) return undefined;
    element.addEventListener('wheel', own.wheel, { passive: false });
    element.addEventListener('touchstart', own.touchstart, { passive: true });
    element.addEventListener('touchmove', own.touchmove, { passive: true });
    element.addEventListener('touchend', own.touchend, { passive: true });
    element.addEventListener('gesturestart', own.gesturestart, { passive: false });
    element.addEventListener('gesturechange', own.gesturechange, { passive: false });
    return () => {
      element.removeEventListener('wheel', own.wheel);
      element.removeEventListener('touchstart', own.touchstart);
      element.removeEventListener('touchmove', own.touchmove);
      element.removeEventListener('touchend', own.touchend);
      element.removeEventListener('gesturestart', own.gesturestart);
      element.removeEventListener('gesturechange', own.gesturechange);
    };
  });
}

/** The listener of each gesture event the grid or a panel takes. */
interface GestureListeners {
  readonly wheel: (event: Event) => void;
  readonly touchstart: (event: Event) => void;
  readonly touchmove: (event: Event) => void;
  readonly touchend: (event: Event) => void;
  readonly gesturestart: (event: Event) => void;
  readonly gesturechange: (event: Event) => void;
}

/** Safari's GestureEvent, which the DOM types do not know. */
interface GestureLike extends UIEvent {
  readonly scale: number;
  readonly clientX: number;
}

/**
 * The listeners that zoom the timeline by gesture (ADR 0090): Ctrl+wheel and Cmd+wheel, which is
 * also how Chrome, Edge and Firefox report a trackpad pinch; a two-finger pinch on a touchscreen;
 * and Safari's own gesture events for a trackpad pinch. Over the grid they zoom over the time
 * area only; over a panel, such as the workload lanes, anywhere. Each keeps the page from zooming
 * where it zooms, multiplies the zoom by the gesture's change, and anchors at the pointer or
 * between the fingers.
 */
function gestureListeners(
  latest: RefObject<LatestView>,
  motion: ZoomMotion,
): { readonly grid: GestureListeners; readonly panel: GestureListeners } {
  /** The viewport x of a client x in the time area, and whether it lies over the time area. */
  const viewportOf = (element: HTMLElement, clientX: number) => {
    const layout = latest.current.layoutOf();
    const viewportX = clientX - element.getBoundingClientRect().left - element.clientLeft;
    const start = timeAreaStart(layout, element.scrollLeft);
    // A pinch that started over the tree columns zooms around the time area's first pixel.
    const x = Math.max(start, Math.min(layout.clientWidth, viewportX));
    return { x, overTime: viewportX >= start };
  };
  const zoom = (element: HTMLElement, factor: number, clientX: number) => {
    const view = latest.current;
    if (view.dragging?.() === true || view.scale === undefined) return;
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return;
    // At a clamp a gesture that would go further changes nothing.
    const { pxPerHour } = view.current;
    if ((factor > 1 && pxPerHour >= zoomClamp.max) || (factor < 1 && pxPerHour <= zoomClamp.min)) {
      return;
    }
    motion.gesture(factor, viewportOf(element, clientX).x);
  };

  const listenersFor = (panel: boolean): GestureListeners => {
    let lastDistance = 0;
    let lastScale = 1;
    // Whether Safari's trackpad pinch began where it zooms.
    let gestureZooms = false;
    const zooms = (element: HTMLElement, clientX: number) =>
      panel || viewportOf(element, clientX).overTime;
    const twoTouches = (event: TouchEvent) => {
      const [first, second] = [event.touches[0], event.touches[1]];
      if (first === undefined || second === undefined || event.touches.length !== 2) {
        return undefined;
      }
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
        if (!zooms(element, wheelEvent.clientX)) return;
        event.preventDefault();
        // A page counts as the time area's height, also over a panel.
        const pageHeight = latest.current.grid.current?.clientHeight ?? element.clientHeight;
        zoom(element, wheelFactor(wheelEvent, pageHeight), wheelEvent.clientX);
      },
      touchstart: (event: Event) => {
        lastDistance = twoTouches(event as TouchEvent)?.distance ?? 0;
      },
      touchmove: (event: Event) => {
        const touches = twoTouches(event as TouchEvent);
        if (touches === undefined) return;
        // Two fingers left of three, or two that met, start the pinch from where they are.
        if (lastDistance === 0) {
          lastDistance = touches.distance;
          return;
        }
        const factor = touches.distance / lastDistance;
        lastDistance = touches.distance;
        zoom(event.currentTarget as HTMLElement, factor, touches.clientX);
      },
      touchend: (event: Event) => {
        if ((event as TouchEvent).touches.length < 2) lastDistance = 0;
      },
      gesturestart: (event: Event) => {
        const element = event.currentTarget as HTMLElement;
        gestureZooms = zooms(element, (event as GestureLike).clientX);
        if (!gestureZooms) return;
        event.preventDefault();
        lastScale = 1;
      },
      gesturechange: (event: Event) => {
        if (!gestureZooms) return;
        event.preventDefault();
        // On iOS the touches lead the same pinch; Safari's gesture only leads on a trackpad.
        if (lastDistance !== 0) return;
        const gesture = event as GestureLike;
        if (gesture.scale <= 0) return;
        const factor = gesture.scale / lastScale;
        lastScale = gesture.scale;
        zoom(event.currentTarget as HTMLElement, factor, gesture.clientX);
      },
    };
  };
  return { grid: listenersFor(false), panel: listenersFor(true) };
}
