// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The text of the time header's ticks. */
function timeHeaderText(gantt: HTMLElement): string {
  return within(gantt).getByRole('columnheader', { name: 'Time' }).textContent ?? '';
}

/**
 * Gives the grid the geometry of a scroller the test browser has no layout for: the content
 * width, the visible width and the scroll position.
 */
/** Scrolls the grid sideways from one position to another, as two scroll events. */
function scrollSideways(gantt: HTMLElement, fromLeft: number, toLeft: number) {
  gantt.scrollLeft = fromLeft;
  fireEvent.scroll(gantt);
  gantt.scrollLeft = toLeft;
  fireEvent.scroll(gantt);
}

function scroller(
  gantt: HTMLElement,
  geometry: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  for (const [key, value] of Object.entries(geometry)) {
    Object.defineProperty(gantt, key, { value, configurable: true, writable: true });
  }
}

describe('the time scroller of the order Gantt (#685)', () => {
  it('contains its overscroll, so a sideways swipe at an edge never navigates the browser', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();

    expect(gantt.className).toContain('overscroll-contain');
  });

  it('extends the range by one span of the preset when the scroll comes within one screen of the right edge, keeping from in the URL', async () => {
    const router = renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    expect(timeHeaderText(gantt)).toContain('Fri 6 Nov');
    expect(timeHeaderText(gantt)).not.toContain('Sun 8 Nov');

    scroller(gantt, { scrollWidth: 3000, clientWidth: 800, scrollLeft: 0 });
    scrollSideways(gantt, 0, 1500);

    await waitFor(() => {
      expect(timeHeaderText(gantt)).toContain('Sun 8 Nov');
    });
    expect(router.state.location.search).toMatchObject({ from: '2026-11-04' });
    expect(screen.getByText('Wed 4 Nov to Fri 6 Nov')).toBeTruthy();
    expect(gantt.getAttribute('aria-label')).toContain('Wed 4 Nov to Fri 6 Nov');
  });

  it('extends the range to the left within one screen of the left edge and keeps the view where it was', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    const widthBefore = Number.parseFloat(
      (gantt.querySelector('[data-overlay]') as HTMLElement).style.width,
    );
    expect(timeHeaderText(gantt)).not.toContain('Sun 1 Nov');

    scroller(gantt, { scrollWidth: 3000, clientWidth: 800, scrollLeft: 1500 });
    scrollSideways(gantt, 1500, 200);

    await waitFor(() => {
      expect(timeHeaderText(gantt)).toContain('Sun 1 Nov');
    });
    const widthAfter = Number.parseFloat(
      (gantt.querySelector('[data-overlay]') as HTMLElement).style.width,
    );
    expect(widthAfter).toBeGreaterThan(widthBefore);
    // The content that was in view stays in view: the scroll position moved by the added width.
    await waitFor(() => {
      expect(gantt.scrollLeft).toBe(200 + (widthAfter - widthBefore));
    });
  });

  it('a vertical scroll extends nothing, and a leftward scroll in a narrow range extends the earlier side only', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    // A range under two screens wide: the right edge is within one screen from anywhere, so the
    // first rightward scroll loads the later span once.
    scroller(gantt, { scrollWidth: 1200, clientWidth: 800, scrollLeft: 0 });
    Object.defineProperty(gantt, 'scrollTop', { value: 0, configurable: true, writable: true });
    scrollSideways(gantt, 0, 300);
    await waitFor(() => {
      expect(timeHeaderText(gantt)).toContain('Sun 8 Nov');
    });

    gantt.scrollTop = 120;
    fireEvent.scroll(gantt);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(timeHeaderText(gantt)).not.toContain('Wed 11 Nov');
    expect(timeHeaderText(gantt)).not.toContain('Sun 1 Nov');

    // Scrolling left from 300 to 100 heads for the left edge: the earlier span loads, not another later one.
    gantt.scrollLeft = 100;
    fireEvent.scroll(gantt);

    await waitFor(() => {
      expect(timeHeaderText(gantt)).toContain('Sun 1 Nov');
    });
    expect(timeHeaderText(gantt)).not.toContain('Wed 11 Nov');
  });

  it('Later moves from and forgets the extension', async () => {
    const router = renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    scroller(gantt, { scrollWidth: 3000, clientWidth: 800, scrollLeft: 0 });
    scrollSideways(gantt, 0, 1500);
    await waitFor(() => {
      expect(timeHeaderText(gantt)).toContain('Sun 8 Nov');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show later range' }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ from: '2026-11-07' });
    });
    await waitFor(() => {
      expect(timeHeaderText(gantt)).toContain('Sat 7 Nov');
    });
    expect(timeHeaderText(gantt)).not.toContain('Tue 10 Nov');
  });
});
