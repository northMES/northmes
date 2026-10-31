// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import type { Page } from '@playwright/test';
import { expect, plant, test } from '../fixtures.ts';

// The frame budget of a zoom gesture (ADR 0090, Laying out a zoom; ADR 0030's SP3 criteria): a
// Ctrl+wheel gesture across the hours to 4 weeks bands keeps p95 frame time at most 33 ms and no
// long task over 50 ms, on the board and on the Gantt. The numbers mean something only on the
// planner PC class, so the budget is checked only with NORTHMES_PERF=1, by hand on such a PC; in
// every other run the spec checks that the gesture runs and draws frames. It measures the fixture
// G1 until the SP3 and SP3b volumes have a fixture.

const checkBudget = process.env.NORTHMES_PERF === '1';
test.use({ viewport: { width: 1440, height: 900 } });

/** Starts recording frame times and long tasks in the page. */
async function record(page: Page): Promise<void> {
  await page.evaluate(() => {
    const frames: number[] = [];
    const longTasks: number[] = [];
    const store = window as unknown as {
      perf: { frames: number[]; longTasks: number[]; running: boolean };
    };
    store.perf = { frames, longTasks, running: true };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: false });
    let last = performance.now();
    const tick = (now: number) => {
      frames.push(now - last);
      last = now;
      if (store.perf.running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Stops recording and returns the p95 frame time and the longest task. */
async function measured(page: Page): Promise<{ p95: number; longest: number; frames: number }> {
  return page.evaluate(() => {
    const store = window as unknown as {
      perf: { frames: number[]; longTasks: number[]; running: boolean };
    };
    store.perf.running = false;
    const sorted = [...store.perf.frames].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    return { p95, longest: Math.max(0, ...store.perf.longTasks), frames: sorted.length };
  });
}

/** A Ctrl+wheel gesture from 100 px an hour (hours) to about 3 (4 weeks) and back. */
async function gesture(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.keyboard.down('Control');
  // 70 events of 25 px: exp(-3.5), from 100 to about 3 px an hour.
  for (let event = 0; event < 70; event += 1) await page.mouse.wheel(0, 25);
  for (let event = 0; event < 70; event += 1) await page.mouse.wheel(0, -25);
  await page.keyboard.up('Control');
}

for (const view of ['board', 'gantt'] as const) {
  test(`ADR0090 a zoom gesture across the hours to 4 weeks bands keeps the SP3 frame budget on the ${view}`, async ({
    page,
    signIn,
  }) => {
    await signIn(`${planningLinks[view]({ plant }).href}?zoom=hours&from=2026-11-04`);
    const grid = page.getByRole(view === 'board' ? 'grid' : 'treegrid', {
      name: view === 'board' ? /board/ : /order Gantt/,
    });
    await expect(grid).not.toHaveAttribute('aria-busy', 'true');
    const box = await grid.boundingBox();
    if (box === null) throw new Error('The grid is not drawn');

    await record(page);
    await gesture(page, box.x + box.width * 0.7, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const { p95, longest, frames } = await measured(page);

    expect(frames).toBeGreaterThan(30);
    if (checkBudget) {
      expect(p95, 'p95 frame time in ms').toBeLessThanOrEqual(33);
      expect(longest, 'longest task in ms').toBeLessThanOrEqual(50);
    }
  });
}
