// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GanttCalendar, ZoomLevel } from '../../../src/modules/planning/gantt-data.ts';
import { closedWindows } from '../../../src/modules/planning/timeline/availability-shading.ts';
import { bufferScale } from '../../../src/modules/planning/timeline/time-buffer.ts';
import { type TimeRange, zoomLevels } from '../../../src/modules/planning/timeline/time-scale.ts';
import {
  type TimeBufferInput,
  useTimeBuffer,
} from '../../../src/modules/planning/timeline/use-time-buffer.ts';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const plant = { timeZone: 'Europe/Stockholm', productionDayStart: '06:00' };

/** A plant open Monday to Friday from 06:00 to 14:00, with its closed time hidden. */
const calendar: GanttCalendar = {
  name: 'Day shift',
  weekdays: [1, 2, 3, 4, 5],
  shift: { start: '06:00', end: '14:00' },
  breaks: [],
  workingSecondsPerDay: 28_800,
};
const hidingClosed = {
  ...plant,
  closedOf: (range: TimeRange) => closedWindows(calendar, plant.timeZone, range),
};

/** A pointer drag that the test starts and ends, as the move store reports it. */
function dragStore() {
  let dragging = false;
  const listeners = new Set<() => void>();
  return {
    get: () => dragging,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next: boolean) => {
      dragging = next;
      for (const listener of listeners) listener();
    },
  };
}

/** The hook over a grid of 1 000 px whose first 200 px stick, with the URL as props. */
function renderBuffer(
  from: string,
  zoom: ZoomLevel = 'day',
  extra: Partial<TimeBufferInput> = {},
  element: HTMLElement | null = document.createElement('div'),
) {
  const grid: { current: HTMLElement | null } = { current: element };
  const onNavigate = vi.fn<(zoom: number, from: string) => void>();
  const base: TimeBufferInput = {
    zoom: zoomLevels[zoom].pxPerHour,
    from,
    nowMs: Date.UTC(2026, 10, 2, 8, 40),
    widthPx: 1000,
    grid,
    columns: { treeWidth: 200, stickyWidth: 200 },
    plant,
    onNavigate,
    ...extra,
  };
  const view = renderHook((props: TimeBufferInput) => useTimeBuffer(props), {
    initialProps: base,
  });
  /** Scrolls the grid by some pixels and lets the scroll rest, so the view writes `from`. */
  const scrollBy = (px: number) => {
    act(() => {
      if (grid.current !== null) grid.current.scrollLeft += px;
      view.result.current.onScroll();
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
  };
  return { view, grid, onNavigate, base, scrollBy };
}

describe('useTimeBuffer (ADR 0089, The endless axis)', () => {
  it('ADR0089 opens with the URL start at the left edge of the view, one viewport width into the buffer', () => {
    const { view, grid } = renderBuffer('2026-11-04');

    expect(grid.current?.scrollLeft).toBeCloseTo(800, 0);
    expect(view.result.current.visible.get()?.fromMs).toBe(Date.UTC(2026, 10, 4, 5));
    expect(view.result.current.scale?.widthPx).toBeCloseTo(2400, 0);
  });

  it('ADR0089 writes the visible start when scrolling rests, and the URL catching up rebuilds nothing', () => {
    const { view, grid, onNavigate, base, scrollBy } = renderBuffer('2026-11-04');
    const range = view.result.current.range;

    // Two hours later at 48 px an hour.
    scrollBy(96);

    expect(onNavigate).toHaveBeenLastCalledWith(48, '2026-11-04T08:00');
    view.rerender({ ...base, from: '2026-11-04T08:00' });
    expect(view.result.current.range).toBe(range);
    expect(grid.current?.scrollLeft).toBeCloseTo(896, 0);
  });

  it('ADR0089 rebuilds nothing when a URL it wrote arrives after a later one it wrote, as a slow router delivers them', () => {
    const { view, grid, onNavigate, base, scrollBy } = renderBuffer('2026-11-04');
    const range = view.result.current.range;

    scrollBy(96);
    scrollBy(96);
    expect(onNavigate.mock.calls.map(([, from]) => from)).toEqual([
      '2026-11-04T08:00',
      '2026-11-04T10:00',
    ]);

    // The router delivers the first write after the view wrote the second.
    view.rerender({ ...base, from: '2026-11-04T08:00' });
    view.rerender({ ...base, from: '2026-11-04T10:00' });

    expect(view.result.current.range).toBe(range);
    expect(grid.current?.scrollLeft).toBeCloseTo(992, 0);
  });

  it('ADR0089 rebuilds around a start the URL names from outside, as Back or a link does', () => {
    const { view, grid, base } = renderBuffer('2026-11-04');

    view.rerender({ ...base, from: '2026-11-10' });

    expect(view.result.current.visible.get()?.fromMs).toBe(Date.UTC(2026, 10, 10, 5));
    expect(grid.current?.scrollLeft).toBeCloseTo(800, 0);
  });

  it('ADR0089 rebuilds around a start it wrote before, once the URL caught up with a later write, as Back to an earlier entry does', () => {
    const { view, grid, base, scrollBy } = renderBuffer('2026-11-04');
    scrollBy(96);
    view.rerender({ ...base, from: '2026-11-04T08:00' });
    scrollBy(96);
    view.rerender({ ...base, from: '2026-11-04T10:00' });

    view.rerender({ ...base, from: '2026-11-04T08:00' });

    expect(view.result.current.visible.get()?.fromMs).toBe(Date.UTC(2026, 10, 4, 7));
    expect(grid.current?.scrollLeft).toBeCloseTo(800, 0);
  });

  it('ADR0089 scrolls a grid that is drawn after its buffer, as after an empty, loading or failed page, to where the view starts', () => {
    const { view, grid, base } = renderBuffer('2026-11-04', 'day', {}, null);
    expect(view.result.current.range).toBeDefined();

    grid.current = document.createElement('div');
    view.rerender({ ...base });

    expect(grid.current.scrollLeft).toBeCloseTo(800, 0);
  });

  it('ADR0089 keeps the start in view when the width changes, with a buffer of three new widths', () => {
    const { view, base, scrollBy } = renderBuffer('2026-11-04');
    scrollBy(96);

    view.rerender({ ...base, from: '2026-11-04T08:00', widthPx: 1200 });

    expect(view.result.current.visible.get()?.fromMs).toBe(Date.UTC(2026, 10, 4, 7));
    expect(view.result.current.scale?.widthPx).toBeCloseTo(3000, 0);
  });

  it('ADR0089 keeps the start in view when Hide closed time is turned on', () => {
    const { view, base, scrollBy } = renderBuffer('2026-11-04');
    scrollBy(96);

    view.rerender({ ...base, from: '2026-11-04T08:00', plant: hidingClosed });

    expect(view.result.current.visible.get()?.fromMs).toBe(Date.UTC(2026, 10, 4, 7));
    expect(view.result.current.scale?.gaps.length).toBeGreaterThan(0);
  });

  it('ADR0089 keeps no buffer while the time area has no width', () => {
    const { view, base } = renderBuffer('2026-11-04');

    view.rerender({ ...base, widthPx: 200 });

    expect(view.result.current.range).toBeUndefined();
    expect(view.result.current.scale).toBeUndefined();
  });

  it('ADR0089 Earlier shows the view one viewport width of drawn axis earlier, closed time hidden, from anywhere in the buffer', () => {
    const { view, scrollBy } = renderBuffer('2026-11-04', 'hours', { plant: hidingClosed });
    // Left of where it opened, but out of the quarter-width margin.
    scrollBy(-300);
    const before = view.result.current.visible.get()?.fromMs ?? 0;

    act(() => view.result.current.page('earlier'));

    const after = view.result.current.visible.get()?.fromMs ?? 0;
    const drawn = bufferScale({ fromMs: after, toMs: before }, 'hours', hidingClosed).widthPx;
    expect(Math.abs(drawn - 800)).toBeLessThanOrEqual(6);
  });

  it('ADR0089 holds the buffer during a pointer drag, and moves it when the drag ends at an edge', () => {
    const drag = dragStore();
    const { view, grid } = renderBuffer('2026-11-04', 'day', { frozen: drag });
    const range = view.result.current.range;

    act(() => drag.set(true));
    act(() => {
      if (grid.current !== null) grid.current.scrollLeft = 1590;
      view.result.current.onScroll();
    });
    expect(view.result.current.range).toBe(range);

    act(() => drag.set(false));

    expect(view.result.current.range).not.toBe(range);
    expect(grid.current?.scrollLeft).toBeCloseTo(790, 0);
  });
});
