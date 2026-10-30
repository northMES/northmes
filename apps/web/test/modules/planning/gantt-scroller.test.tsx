// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { type GanttDataSource, g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** A source that answers from G1 and counts its loads: the Gantt loads once per buffer. */
function countingSource(): { source: GanttDataSource; loads: () => number } {
  let count = 0;
  return {
    source: {
      ...g1DataSource,
      load: (input) => {
        count += 1;
        return g1DataSource.load(input);
      },
    },
    loads: () => count,
  };
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

/** The toolbar's range text, which names the span in view. */
function rangeText(): string {
  return (document.querySelector('[data-range-text]')?.textContent ?? '').trim();
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
    expect(gantt.getAttribute('aria-label')).toBe(`plant-a order Gantt, ${rangeText()}`);
    expect(timeHeaderText(gantt)).toContain('Tue 3 Nov');
  });

  it('ADR0089 moves the buffer by one viewport width near the right edge, with the scroll corrected so the view stays', async () => {
    const { source, loads } = countingSource();
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' }, source);
    const gantt = await findGantt();
    const { bufferWidth, viewport } = geometry(gantt);
    const loaded = loads();

    // The view ends 20 px before the buffer's end, inside the quarter-width margin.
    const left = bufferWidth - viewport - 20;
    scrollTo(gantt, left);
    const shown = rangeText();

    expect(Math.abs(gantt.scrollLeft - (left - viewport))).toBeLessThanOrEqual(7);
    expect(rangeText()).toBe(shown);
    await waitFor(() => expect(loads()).toBe(loaded + 1));
    // The browser reports the corrected position as a scroll event, which moves nothing.
    fireEvent.scroll(gantt);
    expect(loads()).toBe(loaded + 1);
    expect(Math.abs(geometry(gantt).bufferWidth - 3 * viewport)).toBeLessThanOrEqual(7);
  });

  it('#883 keeps the range text with the view however often the planner scrolls to the right edge', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const { viewport } = geometry(gantt);
    const texts: string[] = [];

    for (let step = 0; step < 6; step += 1) {
      const { bufferWidth } = geometry(gantt);
      scrollTo(gantt, bufferWidth - viewport);
      texts.push(rangeText());
      // The buffer keeps three viewport widths; it never grows with the scrolls.
      expect(Math.abs(geometry(gantt).bufferWidth - 3 * viewport)).toBeLessThanOrEqual(7);
    }

    // Each scroll shows a later span than the one before, so the text follows the view.
    expect(new Set(texts).size).toBe(6);
    expect(texts[0]).not.toMatch(/^W45, Mon 2 Nov/);
    // Once scrolling stops, the visible start goes to the URL and names the grid.
    await waitFor(() =>
      expect(router.state.location.search.from).toMatch(/^2026-1[12]-\d\dT\d\d:\d\d$/),
    );
    expect(gantt.getAttribute('aria-label')).toBe(`plant-a order Gantt, ${rangeText()}`);
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
    const { source, loads } = countingSource();
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' }, source);
    const gantt = await findGantt();
    const loaded = loads();
    const left = gantt.scrollLeft;
    const shown = rangeText();

    gantt.scrollTop = 120;
    fireEvent.scroll(gantt);

    expect(gantt.scrollLeft).toBe(left);
    expect(rangeText()).toBe(shown);
    expect(loads()).toBe(loaded);
  });

  it('ADR0089 Earlier and Later show the view one viewport width before or after', async () => {
    const router = renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    await findGantt();

    fireEvent.click(screen.getByRole('button', { name: 'Show later range' }));
    // One viewport width of drawn axis: closed time is hidden by default, so the night of Wed 4
    // Nov takes a few pixels and the view lands on Thursday.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-05T/));

    fireEvent.click(screen.getByRole('button', { name: 'Show earlier range' }));
    await waitFor(() => expect(router.state.location.search.from).toBe('2026-11-04T06:00'));
    expect(rangeText()).toMatch(/^Wed 4 Nov to /);
  });
});
