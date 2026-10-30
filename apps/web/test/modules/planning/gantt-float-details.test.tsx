// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { GanttDataSource } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import {
  detailsOpen,
  findDetails,
  findGantt,
  openDetailsSection,
  renderGanttRoute,
} from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The Float cell of a job order row, found by the row's block id. */
function floatCellOf(gantt: HTMLElement, blockId: string): HTMLElement {
  const row = gantt
    .querySelector<HTMLElement>(`[data-block="${blockId}"]`)
    ?.closest<HTMLElement>('[role="row"]');
  if (row === null || row === undefined) throw new Error(`No row for ${blockId}`);
  const cells = within(row).getAllByRole('gridcell');
  const cell = cells[1];
  if (cell === undefined) throw new Error('No Float cell');
  return cell;
}

describe('the Float column and Details from the analysis (plan 18, What the timeline shows)', () => {
  it('GT1 shows the free float of 1001.20 as "15 min"', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(floatCellOf(gantt, 'jo-1001-20').textContent).toBe('15 min');
    expect(floatCellOf(gantt, 'jo-1001-10').textContent).toBe('0');
    // The locked 1002.10 ends at its deadline, so it is critical with zero free float.
    expect(floatCellOf(gantt, 'jo-1002-10').textContent).toBe('0');
  });

  it('GT2 shows 1003.10 as "0" with the chain glyph and its negative total float "minus 15 min"', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const cell = floatCellOf(gantt, 'jo-1003-10');
    expect(cell.textContent).toBe('0minus 15 min');
    expect(cell.querySelector('svg')).not.toBeNull();
    expect(
      within(cell).getByLabelText('Free float 0, on the critical chain, total float minus 15 min'),
    ).toBeTruthy();
  });

  it('GT4 opens Details on a clicked row with the constraint list of 1004.20, each line holding', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(gantt.querySelector('[data-block="jo-1004-20"]') as HTMLElement);

    const panel = await findDetails();
    expect(within(panel).getByRole('heading', { level: 2 }).textContent).toBe('1004.20 Mill');
    await openDetailsSection(panel, 'Constraints');
    const constraints = within(panel).getByRole('region', { name: 'Constraints, 6 of 6 hold' });
    const lines = within(constraints).getAllByRole('listitem');
    expect(lines.map((line) => line.getAttribute('data-constraint'))).toEqual([
      'deadline',
      'release',
      'lastPiece',
      'allowedMachines',
      'oneJobAtATime',
      'calendar',
    ]);
    expect(lines.every((line) => line.getAttribute('data-holds') === 'true')).toBe(true);
    expect(lines[1]?.textContent).toBe(
      'Release from 1004.10: Thu 5 Nov 09:45 (300 pieces complete at Thu 5 Nov 09:15, lead 30 min)',
    );
    expect(within(panel).getByText('6 h 40 min working')).toBeTruthy();
    expect(within(panel).getByText('22 h 25 min elapsed')).toBeTruthy();
  });

  it('GT1 #917 shows the free float of 1001.20 at a glance, and its total float, wait and binding constraint in Float and timing', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(gantt.querySelector('[data-block="jo-1001-20"]') as HTMLElement);

    const panel = await findDetails();
    expect(
      within(within(panel).getByRole('region', { name: 'At a glance' })).getByText(
        'Fri 6 Nov 15:00, free float 15 min',
      ),
    ).toBeTruthy();
    const toggle = await openDetailsSection(panel, 'Float and timing');
    expect(toggle.getAttribute('aria-label')).toBe('Float and timing, total float 12 h');
    const float = within(panel).getByRole('region', { name: 'Float and timing' });
    expect(float.textContent).toContain('Wait 0 min.');
    expect(float.textContent).toContain('Starts at its release: 1001.10 end plus 1 h lead.');
    expect(float.textContent).toContain(
      'Latest start Thu 5 Nov 13:15, latest end Fri 6 Nov 15:00.',
    );
  });

  it('GT2 names the machine of a machine binding as the rest of Details does: "ends on CNC 1"', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(gantt.querySelector('[data-block="jo-1003-10"]') as HTMLElement);

    const panel = await findDetails();
    await openDetailsSection(panel, 'Float and timing');
    const float = within(panel).getByRole('region', { name: 'Float and timing' });
    expect(float.textContent).toContain('Starts when 1001.10 ends on CNC 1.');
  });

  it('phase 1 draws the fields and the actions of Details disabled with the reason', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(gantt.querySelector('[data-block="jo-1001-20"]') as HTMLElement);

    const panel = await findDetails();
    const machine = within(panel).getByLabelText('Machine') as HTMLSelectElement;
    expect(machine.disabled).toBe(true);
    expect(machine.value).toBe('CNC2');
    expect(
      document.getElementById(machine.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Moves and changes come with the live data; this view reads the fixture G1.');
    // Move works from Details without dragging (WCAG 2.5.7); the other actions wait for the server.
    await userEvent.click(within(panel).getByRole('button', { name: 'Actions for 1001.20' }));
    const menu = await screen.findByRole('menu', { name: 'Actions for 1001.20' });
    const disabled = (name: string) =>
      within(menu).getByRole('menuitem', { name }).getAttribute('aria-disabled');
    expect(disabled('Move')).toBeNull();
    expect(disabled('Lock')).toBe('true');
    expect(disabled('Show critical chain')).toBeNull();
    expect(
      within(menu).getByText(
        'Moves and changes come with the live data; this view reads the fixture G1.',
      ),
    ).toBeTruthy();
  });

  it('shows the order details with deadline, slack or late-by and the operations', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(
      within(within(gantt).getByRole('row', { name: /^1003 / })).getByRole('rowheader'),
    );

    const panel = await findDetails();
    expect(within(panel).getByRole('heading', { level: 2 }).textContent).toBe('Order 1003');
    expect(panel.textContent).toContain('Wed 4 Nov 15:00, end of shift');
    expect(panel.querySelector('[data-exception]')?.textContent).toBe('Late by 15 h 15 min');
    expect(panel.textContent).toContain('15 min on Mill 1');
    expect(panel.textContent).toContain('2: Turn on CNC 1, Mill on Mill 1');
  });

  it('closes Details and forgets the row when a reload drops it, and opens again for another row', async () => {
    // Week 45 answers G1; the week after, reached with Later, answers G1 without order 1003.
    const source: GanttDataSource = {
      load: async ({ from }) => {
        const snapshot = g1Snapshot();
        return Date.parse(from) < Date.UTC(2026, 10, 8)
          ? snapshot
          : {
              ...snapshot,
              productionOrders: snapshot.productionOrders.filter(
                (order) => order.number !== '1003',
              ),
            };
      },
    };
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);
    const gantt = await findGantt();
    await userEvent.dblClick(gantt.querySelector('[data-block="jo-1003-20"]') as HTMLElement);
    await findDetails();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(detailsOpen()).toBe(false);
    });
    await userEvent.dblClick(gantt.querySelector('[data-block="jo-1003-20"]') as HTMLElement);
    await findDetails();

    // A reload while Details is open, as a realtime refetch gives: the next week drops 1003.
    await router.navigate({
      to: '.',
      search: { view: 'gantt', zoom: 'week', from: '2026-11-09' } as Record<string, unknown>,
    });

    await waitFor(() => {
      expect(gantt.querySelector('[data-block="jo-1003-20"]')).toBeNull();
    });
    await waitFor(() => {
      expect(detailsOpen()).toBe(false);
    });
    await userEvent.dblClick(gantt.querySelector('[data-block="jo-1001-20"]') as HTMLElement);
    const panel = await findDetails();
    expect(within(panel).getByRole('heading', { level: 2 }).textContent).toBe('1001.20 Mill');
  });
});
