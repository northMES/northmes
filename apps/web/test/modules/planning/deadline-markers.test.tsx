// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, markerTexts, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

describe('deadline markers (plan 18, Deadlines on the timeline)', () => {
  it('GT9 shows the late band of 1003 from Wed 15:00 to Thu 06:15 and "late by 15 h 15 min"', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const row = within(gantt).getByRole('row', { name: /^1003 / });
    expect(markerTexts(row, 'lateBand')).toEqual([
      'late by 15 h 15 min, Wed 4 Nov 15:00 to Thu 5 Nov 06:15',
    ]);
    expect(markerTexts(row, 'deadline')).toEqual(['deadline Wed 4 Nov 15:00']);
    expect(within(row).getByRole('rowheader').textContent).toContain('late by 15 h 15 min');
    const band = row.querySelector<HTMLElement>('[data-marker="lateBand"]');
    const marker = row.querySelector<HTMLElement>('[data-marker="deadline"]');
    expect(band?.style.left).toBe(marker?.style.left);
    expect(Number.parseFloat(band?.style.width ?? '0')).toBeGreaterThan(0);
  });

  it('GT9 shows the marker of 1001 and no band', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const row = within(gantt).getByRole('row', { name: /^1001 / });
    expect(markerTexts(row, 'deadline')).toEqual(['deadline Fri 6 Nov 15:00']);
    expect(markerTexts(row, 'lateBand')).toEqual([]);
  });

  it('GT9 labels the deadline marker with the plant time at Day zoom only', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();

    const row = within(gantt).getByRole('row', { name: /^1003 / });
    expect(row.querySelector('[data-marker="deadline"]')?.textContent).toBe('15:00');
  });

  it('#885 labels the now line on the time header with the plant time alone, not the date', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    // The ticks of the Week preset read "06:00", "12:00" and "18:00", so the one element of the
    // header whose text holds 09:40 is the now label; its whole text is the clock.
    const header = within(gantt).getByRole('columnheader', { name: 'Time' });
    expect(within(header).getByText(/09:40/).textContent).toBe('09:40');
  });

  it('GT8 draws the frozen band from now to the fence and the now line over every row', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const overlay = gantt.querySelector<HTMLElement>('[data-overlay]');
    if (overlay === null) throw new Error('No overlay');
    expect(markerTexts(overlay, 'frozen')).toEqual([
      'frozen window, Mon 2 Nov 09:40 to Tue 3 Nov 09:40',
    ]);
    expect(markerTexts(overlay, 'now')).toEqual(['now, Mon 2 Nov 09:40']);
  });

  it('GT9 draws nothing of a marker outside the visible range', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();

    const row = within(gantt).getByRole('row', { name: /^1006 / });
    expect(markerTexts(row, 'deadline')).toEqual([]);
    const overlay = gantt.querySelector<HTMLElement>('[data-overlay]');
    expect(markerTexts(overlay as HTMLElement, 'now')).toEqual([]);
  });
});
