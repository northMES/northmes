// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import {
  detailsOpen,
  findDetails,
  findGantt,
  markerTexts,
  renderBoardRoute,
} from './gantt-fixtures.tsx';

afterEach(cleanup);

const spoken = () => document.getElementById(politeRegionId)?.textContent;

describe('the critical chain highlight (plan 18, Float and the critical chain)', () => {
  it('GT2 ?order=po-1003&chain=1 highlights the three chain rows, ticks their latest start and end, and announces it', async () => {
    renderBoardRoute({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    const gantt = await findGantt();

    await waitFor(() => {
      expect(spoken()).toBe('Critical chain of 1003 shown, 3 rows, root 1001.10 on CNC1');
    });
    for (const id of ['jo-1003-20', 'jo-1003-10', 'jo-1001-10']) {
      const block = gantt.querySelector(`[data-block="${id}"]`);
      expect(block?.getAttribute('data-states')).toContain('chain');
      expect(block?.getAttribute('aria-label')).toContain('on the critical chain');
      const row = block?.closest('[role="row"]') as HTMLElement;
      expect(markerTexts(row, 'latestStart')).toHaveLength(1);
      expect(markerTexts(row, 'latestEnd')).toHaveLength(1);
    }
    expect(
      gantt.querySelector('[data-block="jo-1001-20"]')?.getAttribute('data-states'),
    ).toBeNull();
    const row1003 = gantt
      .querySelector('[data-block="jo-1003-20"]')
      ?.closest('[role="row"]') as HTMLElement;
    expect(markerTexts(row1003, 'latestEnd')).toEqual(['latest end Wed 4 Nov 15:00']);
  });

  it('GT2 Show critical chain on order 1003 explains the chain with the text of the spec, each row a link', async () => {
    const router = renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.click(
      within(within(gantt).getByRole('row', { name: /^1003 / })).getByRole('rowheader'),
    );
    const panel = await findDetails();
    await userEvent.click(within(panel).getByRole('button', { name: 'Show critical chain' }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        view: 'gantt',
        zoom: 'week',
        from: '2026-11-02',
        order: 'po-1003',
        chain: 1,
      });
    });
    const section = within(panel).getByRole('region', {
      name: 'Critical chain, 3 rows, root 1001.10 on CNC 1',
    });
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '1003 is late by 15 h 15 min.',
      '1003.20 on Mill 1 starts when 1003.10 ends.',
      '1003.10 on CNC 1 waits 6 h 50 min for 1001.10.',
      '1001.10 is free and has 11 h 45 min of total float.',
    ]);
    expect(
      within(section)
        .getAllByRole('button')
        .map((link) => link.textContent),
    ).toEqual(['1003.20', '1003.10', '1001.10']);

    await userEvent.click(within(section).getByRole('button', { name: '1001.10' }));

    // The link closes the drawer and focuses the row it names.
    await waitFor(() => {
      expect(detailsOpen()).toBe(false);
    });
    await waitFor(() => {
      expect(document.activeElement?.getAttribute('data-row-id')).toBe('jo-1001-10');
    });
  });

  it('GT2 Escape ends the chain highlight and announces it', async () => {
    const router = renderBoardRoute({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    const gantt = await findGantt();
    await waitFor(() => {
      expect(spoken()).toBe('Critical chain of 1003 shown, 3 rows, root 1001.10 on CNC1');
    });

    const row = gantt
      .querySelector('[data-block="jo-1003-20"]')
      ?.closest('[role="row"]') as HTMLElement;
    row.focus();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        view: 'gantt',
        zoom: 'week',
        from: '2026-11-02',
        order: 'po-1003',
      });
    });
    await waitFor(() => {
      expect(spoken()).toBe('Chain hidden');
    });
    expect(gantt.querySelector('[data-block="jo-1003-20"]')?.getAttribute('data-states')).toBe(
      'late',
    );
  });

  it('GT1 the chain of an on-time order says why it lies where it lies', async () => {
    renderBoardRoute({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1001',
      chain: 1,
    });
    const gantt = await findGantt();

    await userEvent.click(
      within(within(gantt).getByRole('row', { name: /^1001 / })).getByRole('rowheader'),
    );

    const panel = await findDetails();
    const section = within(panel).getByRole('region', {
      name: 'Critical chain, 2 rows, root 1001.10 on CNC 1',
    });
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '1001 is on time, slack 1 day 4 h 15 min.',
      '1001.20 on CNC 2 starts when 1001.10 ends.',
      '1001.10 is free and has 11 h 45 min of total float.',
    ]);
  });
});
