// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The Not placed row of the order Gantt sticks under the time header while the rows scroll up
// beneath it. The data rows' sticky tree cells must pass under it, not over it (#911).

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

test.describe('the Not placed row of the order Gantt', () => {
  // With equal z-indexes and no stacking context between them, DOM order broke the tie and the
  // later rows' Name cells painted over the label (#911).
  test('#911 the Not placed label stays on top when the grid scrolls down', async ({
    page,
    signIn,
  }) => {
    await signIn(ganttHref({ zoom: 'week', from: '2026-11-02' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();

    const hit = await gantt.evaluate((grid) => {
      grid.scrollTop = 200;
      const row = grid.querySelector('[aria-rowindex="2"]') as HTMLElement;
      const label = row.querySelector('[role="rowheader"]') as HTMLElement;
      const box = label.getBoundingClientRect();
      const at = document.elementFromPoint(box.left + 20, box.top + box.height / 2);
      return { scrolled: grid.scrollTop, onRow: at !== null && row.contains(at) };
    });
    // The rows scrolled under the pinned row, where the bug showed.
    expect(hit.scrolled).toBe(200);
    expect(hit.onRow).toBe(true);
  });
});
