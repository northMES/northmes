// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { findGantt, renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.setItem(
    'northmes.planning.gantt.options',
    JSON.stringify({ workload: true }),
  );
});

afterEach(() => {
  window.localStorage.removeItem('northmes.planning.gantt.options');
});

describe('the workload lane (plan 18, The workload lane)', () => {
  it('GT5 shows a lane per machine, aria-hidden, under the time area when the option is on', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    const panel = screen.getByRole('region', { name: 'Workload' });
    expect(
      within(panel)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Workload on CNC 1', 'Workload on CNC 2', 'Workload on Mill 1']);
    const lane = panel.querySelector('[data-lane="CNC1"]');
    expect(lane?.getAttribute('aria-hidden')).toBe('true');
  });

  it('GT5 draws the bar of Thu 5 Nov on CNC1 at full height, the setup part hatched', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    const lane = screen
      .getByRole('region', { name: 'Workload' })
      .querySelector('[data-lane="CNC1"]');
    const thursday = lane?.querySelector<HTMLElement>('[data-bucket="2026-11-05"]');
    // A full bucket takes the bar's 75 percent of the lane; the rest is headroom for an overload.
    expect(thursday?.style.height).toBe('75%');
    expect(thursday?.getAttribute('data-full')).toBe('true');
    expect(thursday?.querySelector('[data-setup]')).not.toBeNull();
    const tuesday = lane?.querySelector<HTMLElement>('[data-bucket="2026-11-03"]');
    expect(Number.parseFloat(tuesday?.style.height ?? '0')).toBeCloseTo(42.42 * 0.75, 1);
    expect(lane?.querySelector<HTMLElement>('[data-bucket="2026-11-02"]')?.style.height).toBe('0%');
  });

  it('GT6 draws the overload of CNC2 on Thu 5 Nov above the bar, inside the lane', async () => {
    // GT6: a row of 3 600 s at Thu 12:00 over the locked 1002.10 gives 32 400 s loaded against
    // 29 700 s available on CNC2 and 2 700 s of overload.
    const snapshot = g1Snapshot();
    const overloaded = {
      ...snapshot,
      analysis: {
        ...snapshot.analysis,
        workload: snapshot.analysis.workload.map((bucket) =>
          bucket.equipment === 'CNC2' && bucket.label === '2026-11-05'
            ? {
                ...bucket,
                loadedS: 32_400,
                runS: 32_400,
                utilizationPermille: 1091,
                overloadS: 2_700,
              }
            : bucket,
        ),
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(overloaded));
    await findGantt();

    const lane = screen
      .getByRole('region', { name: 'Workload' })
      .querySelector('[data-lane="CNC2"]');
    const thursday = lane?.querySelector<HTMLElement>('[data-bucket="2026-11-05"]');
    expect(thursday?.getAttribute('data-overloaded')).toBe('true');
    // The bar takes the 75 percent of the lane a full bucket takes; the overload sits above it in
    // the headroom, 2 700 of 29 700 s as a share of the bar's height, so it stays inside the lane.
    expect(thursday?.style.height).toBe('75%');
    const overload = thursday?.querySelector<HTMLElement>('[data-overload]');
    expect(Number.parseFloat(overload?.style.height ?? '0')).toBeCloseTo(
      (2700 / 29700) * 0.75 * 2.5,
      3,
    );
    expect(Number.parseFloat(overload?.style.height ?? '0')).toBeLessThanOrEqual(0.25 * 2.5);
  });

  it("GT5 opening a second lane's table mounts it anew and moves focus to it", async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 1' }));
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Workload on CNC 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Workload on CNC 2' }));

    const second = screen.getByRole('dialog', { name: 'Workload on CNC 2' });
    expect(screen.queryByRole('dialog', { name: 'Workload on CNC 1' })).toBeNull();
    expect(document.activeElement).toBe(second);
    expect(
      screen.getByRole('button', { name: 'Workload on CNC 1' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('GT5 the lane header button opens the text table: the seven production days of week 45 and the visible range, with the GT5 values of Thu 5 Nov, a closed Saturday and the range', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    const button = screen.getByRole('button', { name: 'Workload on CNC 1' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(button);

    const dialog = screen.getByRole('dialog', { name: 'Workload on CNC 1' });
    expect(document.activeElement).toBe(dialog);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const table = within(dialog).getByRole('table', { name: 'Workload on CNC 1' });
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent));
    // Mon 2 Nov to Sun 8 Nov, then the visible range; the GT5 values of g1.expected.json are
    // compared whole in gantt-analysis.test.ts.
    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row[0])).toEqual([
      'Mon 2 Nov',
      'Tue 3 Nov',
      'Wed 4 Nov',
      'Thu 5 Nov',
      'Fri 6 Nov',
      'Sat 7 Nov',
      'Sun 8 Nov',
      'Visible range',
    ]);
    // The weekend's production days are closed buckets, drawn as nothing and named closed.
    expect(rows[5]).toEqual([
      'Sat 7 Nov',
      '0 min',
      '0 min',
      '0 min',
      '0 min',
      '0 min',
      'closed',
      '0 min',
    ]);
    expect(rows[7]).toEqual([
      'Visible range',
      '41 h 15 min',
      '20 h',
      '1 h',
      '19 h',
      '21 h 15 min',
      '48 %',
      '0 min',
    ]);
    expect(rows[3]).toEqual([
      'Thu 5 Nov',
      '8 h 15 min',
      '8 h 15 min',
      '30 min',
      '7 h 45 min',
      '0 min',
      '100 %',
      '0 min',
    ]);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
