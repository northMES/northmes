// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDay } from '@northmes/contracts/format';
import { g1Expected } from '@northmes/planning-domain';
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findGantt, renderBoardRoute } from './gantt-fixtures.tsx';

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

/** The GT5 buckets of a machine for week 45, as the table prints them. */
function expectedRows(equipment: string): string[][] {
  return g1Expected.GT5_workload_week45.filter((bucket) => bucket.equipment === equipment).map(
    (bucket) => [
      formatPlantDay(bucket.productionDay),
      formatDuration(bucket.availableS),
      formatDuration(bucket.loadedS),
      formatDuration(bucket.setupS),
      formatDuration(bucket.runS),
      formatDuration(Math.max(0, bucket.availableS - bucket.loadedS)),
      `${Math.round(bucket.utilizationPermille / 10)} %`,
      formatDuration(bucket.overloadS),
    ],
  );
}

describe('the workload lane (plan 18, The workload lane)', () => {
  it('GT5 shows a lane per machine, aria-hidden, under the time area when the option is on', async () => {
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
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
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    await findGantt();

    const lane = screen
      .getByRole('region', { name: 'Workload' })
      .querySelector('[data-lane="CNC1"]');
    const thursday = lane?.querySelector<HTMLElement>('[data-bucket="2026-11-05"]');
    expect(thursday?.style.height).toBe('100%');
    expect(thursday?.getAttribute('data-full')).toBe('true');
    expect(thursday?.querySelector('[data-setup]')).not.toBeNull();
    const tuesday = lane?.querySelector<HTMLElement>('[data-bucket="2026-11-03"]');
    expect(Number.parseFloat(tuesday?.style.height ?? '0')).toBeCloseTo(42.42, 1);
    expect(lane?.querySelector<HTMLElement>('[data-bucket="2026-11-02"]')?.style.height).toBe('0%');
  });

  it('GT5 the lane header button opens the text table with every value, which equals GT5', async () => {
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
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
    expect(rows.slice(0, 5)).toEqual(expectedRows('CNC1'));
    expect(rows[5]).toEqual([
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
