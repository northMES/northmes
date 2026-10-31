// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The first cell of the time header, which a move of the time buffer changes. */
function bufferStart(gantt: HTMLElement): string {
  return gantt.querySelector('[data-tier="top"] .sr-only')?.textContent ?? '';
}

/** The test browser lays nothing out, so the grid is the 1 100 px the view assumes. */
const gridWidth = 1100;

/** The grid across: the buffer's width, the sticky columns and the visible time area. */
function geometry(gantt: HTMLElement) {
  const overlay = gantt.querySelector<HTMLElement>('[data-overlay]') as HTMLElement;
  const stickyWidth = Number.parseFloat(gantt.style.scrollPaddingInlineStart);
  return {
    bufferWidth: Number.parseFloat(overlay.style.width),
    viewport: gridWidth - stickyWidth,
  };
}

/**
 * The span in view, as the grid's name says it once scrolling stops: the bar above the timeline has
 * no range text (ADR 0090).
 */
function rangeText(): string {
  const name = document.querySelector('[role="treegrid"]')?.getAttribute('aria-label') ?? '';
  return name.replace(/^plant-a order Gantt, /, '');
}

function timeHeaderText(gantt: HTMLElement): string {
  return within(gantt).getByRole('columnheader', { name: 'Time' }).textContent ?? '';
}

function scrollTo(gantt: HTMLElement, left: number) {
  gantt.scrollLeft = left;
  fireEvent.scroll(gantt);
}

// The contained overscroll, so a sideways swipe at an edge never navigates the browser, is read
// from computed style in e2e/planning/gantt-scroller.spec.ts.
describe('the endless axis of the order Gantt (ADR 0089, #883)', () => {
  it('ADR0089 opens with the start in the URL at the left edge of the view, inside a buffer of three viewport widths', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();

    const { bufferWidth, viewport } = geometry(gantt);
    expect(Math.abs(bufferWidth - 3 * viewport)).toBeLessThanOrEqual(7);
    // The view starts one viewport width into the buffer, at Wed 4 Nov 06:00.
    expect(gantt.scrollLeft).toBeGreaterThan(0.75 * viewport);
    expect(rangeText()).toMatch(/^Wed 4 Nov to /);
    // The header's top tier names the dates in view, and the buffer's day before.
    expect(timeHeaderText(gantt)).toContain('Wed 4 Nov');
    expect(timeHeaderText(gantt)).toContain('Tue 3 Nov');
  });

  it('ADR0089 moves the buffer by one viewport width near the right edge, with the scroll corrected so the view stays', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    const { bufferWidth, viewport } = geometry(gantt);
    const before = bufferStart(gantt);

    // The view ends 20 px before the buffer's end, inside the quarter-width margin.
    const left = bufferWidth - viewport - 20;
    scrollTo(gantt, left);
    const shown = rangeText();

    expect(Math.abs(gantt.scrollLeft - (left - viewport))).toBeLessThanOrEqual(7);
    expect(rangeText()).toBe(shown);
    const moved = bufferStart(gantt);
    expect(moved).not.toBe(before);
    // The browser reports the corrected position as a scroll event, which moves nothing.
    fireEvent.scroll(gantt);
    expect(bufferStart(gantt)).toBe(moved);
    expect(Math.abs(geometry(gantt).bufferWidth - 3 * viewport)).toBeLessThanOrEqual(7);
  });

  it('#883 keeps the header with the view however often the planner scrolls to the right edge', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const { viewport } = geometry(gantt);
    const starts: string[] = [];

    for (let step = 0; step < 6; step += 1) {
      const { bufferWidth } = geometry(gantt);
      scrollTo(gantt, bufferWidth - viewport);
      starts.push(bufferStart(gantt));
      // The buffer keeps three viewport widths; it never grows with the scrolls.
      expect(Math.abs(geometry(gantt).bufferWidth - 3 * viewport)).toBeLessThanOrEqual(7);
    }

    // Each scroll moves the buffer later, so the header's dates follow the view.
    expect(new Set(starts).size).toBe(6);
    // Once scrolling stops, the visible start goes to the URL and names the grid.
    await waitFor(() =>
      expect(router.state.location.search.from).toMatch(/^2026-1[12]-\d\dT\d\d:\d\d$/),
    );
    await waitFor(() => expect(rangeText()).not.toMatch(/^W45, Mon 2 Nov/));
  });

  it('ADR0089 writes the visible start to the URL with replace when scrolling stops', async () => {
    const router = renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    const entries = router.history.length;

    // One hour later at 48 px an hour.
    scrollTo(gantt, gantt.scrollLeft + 48);

    await waitFor(() => expect(router.state.location.search.from).toBe('2026-11-04T07:00'));
    expect(router.history.length).toBe(entries);
    expect(rangeText()).toMatch(/^Wed 4 Nov to /);
  });

  it('ADR0089 a vertical scroll moves nothing', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    const before = bufferStart(gantt);
    const left = gantt.scrollLeft;
    const shown = rangeText();

    gantt.scrollTop = 120;
    fireEvent.scroll(gantt);

    expect(gantt.scrollLeft).toBe(left);
    expect(rangeText()).toBe(shown);
    expect(bufferStart(gantt)).toBe(before);
  });

  it('#939 Alt+Page Down and Alt+Page Up show the view one viewport width after or before', async () => {
    const router = renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    const row = () => gantt.querySelector<HTMLElement>('[data-row-id="po-1003"]') as HTMLElement;

    fireEvent.keyDown(row(), { key: 'PageDown', altKey: true });
    // One viewport width of drawn axis: closed time is hidden by default, so the night of Wed 4
    // Nov takes a few pixels and the view lands on Thursday.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-05T/));

    fireEvent.keyDown(row(), { key: 'PageUp', altKey: true });
    await waitFor(() => expect(router.state.location.search.from).toBe('2026-11-04T06:00'));
    await waitFor(() => expect(rangeText()).toMatch(/^Wed 4 Nov to /));
  });
});
