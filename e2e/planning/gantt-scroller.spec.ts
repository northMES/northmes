// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The time scroller of the order Gantt (#685): a sideways overscroll at an edge never navigates
// the browser history, and the loaded range grows by a span of the preset as the planner scrolls
// towards an edge, with the chosen start kept in the URL.

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the time scroller of the order Gantt', () => {
  // The browser turns a sideways overscroll at an edge into a history navigation only when the
  // scroller lets it through, and headless Chromium never does, so the computed style is the guard.
  test('#685 the grid contains its overscroll, so a wheel past an edge never navigates the history', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'day', from: '2026-11-04' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();

    const overscroll = await gantt.evaluate((grid) => {
      const style = getComputedStyle(grid);
      return { x: style.overscrollBehaviorX, y: style.overscrollBehaviorY };
    });
    expect(overscroll).toEqual({ x: 'contain', y: 'contain' });
  });

  test('#685 scrolling to the right edge loads the next span of the preset and keeps from', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'day', from: '2026-11-04' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    const header = gantt.getByRole('columnheader', { name: 'Time' });
    await expect(header).toContainText('Fri 6 Nov');
    // Closed time is hidden by default, so the closed weekend has no label (#892): the next span
    // shows from its first open weekday.
    await expect(header).not.toContainText('Mon 9 Nov');

    await gantt.evaluate((grid) => {
      grid.scrollLeft = grid.scrollWidth;
    });

    await expect(header).toContainText('Mon 9 Nov');
    expect(new URL(page.url()).searchParams.get('from')).toBe('2026-11-04');
    await expect(page.getByText('Wed 4 Nov to Fri 6 Nov')).toBeVisible();
    // The grid keeps scrolling: the content is wider than before and the rows kept their height.
    const widths = await gantt.evaluate((grid) => ({
      scroll: grid.scrollWidth,
      client: grid.clientWidth,
      row: (grid.querySelector('[data-row-id="jo-1003-10"]') as HTMLElement).getBoundingClientRect()
        .height,
    }));
    expect(widths.scroll).toBeGreaterThan(widths.client);
    expect(widths.row).toBeGreaterThan(40);
  });
});
