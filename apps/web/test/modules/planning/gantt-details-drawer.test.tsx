// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime } from '@northmes/contracts/format';
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { phase1Reason } from '../../../src/modules/planning/mock-reasons.ts';
import {
  detailsOpen,
  findDetails,
  findGantt,
  plant,
  renderGanttRoute,
  sourceOf,
} from './gantt-fixtures.tsx';

afterEach(cleanup);

/** Opens the Details of a job order's block and returns the drawer. */
async function openDetails(gantt: HTMLElement, blockId: string): Promise<HTMLElement> {
  const block = gantt.querySelector<HTMLElement>(`[data-block="${blockId}"]`);
  if (block === null) throw new Error(`No block ${blockId}`);
  await userEvent.dblClick(block);
  return findDetails();
}

/** The terms and their definitions of a list, as "term: definition". */
function entriesOf(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('dt')).map(
    (term) => `${term.textContent}: ${term.nextElementSibling?.textContent ?? ''}`,
  );
}

/** The section toggles of the drawer: their names and whether each is open. */
function togglesOf(panel: HTMLElement): string[] {
  return Array.from(panel.querySelectorAll<HTMLElement>('[data-section-toggle]')).map(
    (toggle) => `${toggle.textContent} (${toggle.getAttribute('aria-expanded')})`,
  );
}

/** How often a text occurs in an element's text. */
function countOf(element: HTMLElement, text: string): number {
  return (element.textContent ?? '').split(text).length - 1;
}

describe('the Details drawer leads with the move decision (#917)', () => {
  it('#917 gives 1001.20 a header, At a glance and closed sections, with no Hover fields or Actions section', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const panel = await openDetails(await findGantt(), 'jo-1001-20');

    expect(within(panel).getByRole('heading', { level: 2 }).textContent).toBe('1001.20 Mill');
    expect(within(panel).getByRole('link', { name: 'Order 1001' }).getAttribute('href')).toBe(
      planningLinks.orders.order({ plant, orderId: 'po-1001' }).href,
    );
    expect(within(panel).getByText('Bracket L, 600 pcs')).toBeTruthy();
    expect(within(panel).getByText('Planned')).toBeTruthy();
    expect(panel.querySelector('[data-exception]')).toBeNull();

    const glance = within(panel).getByRole('region', { name: 'At a glance' });
    expect((within(glance).getByLabelText('Machine') as HTMLSelectElement).value).toBe('CNC2');
    expect(entriesOf(glance).slice(1)).toEqual([
      'Time: Wed 4 Nov 09:00 to Thu 5 Nov 10:4510 h working, 25 h 45 min elapsed',
      'Deadline: Fri 6 Nov 15:00, free float 15 min',
      'Customer: Hallberg Verkstad AB, Svea Komponent AB',
      'Before: 1001.10 on CNC 1, ends Wed 4 Nov 08:00',
    ]);

    expect(togglesOf(panel)).toEqual([
      'Constraints, 6 of 6 hold (false)',
      'Float and timing, total float 12 h (false)',
      'Setup and run, 0 min, 10 h (false)',
    ]);
    expect(within(panel).queryByRole('region', { name: 'Hover fields' })).toBeNull();
    expect(within(panel).queryByRole('region', { name: 'Actions' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Lock' })).toBeNull();
  });

  it('#917 names the operation after a job order with its start', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const panel = await openDetails(await findGantt(), 'jo-1001-10');

    const glance = within(panel).getByRole('region', { name: 'At a glance' });
    expect(entriesOf(glance)).toContain('After: 1001.20 on CNC 2, starts Wed 4 Nov 09:00');
    expect(entriesOf(glance).some((entry) => entry.startsWith('Before:'))).toBe(false);
  });

  it('#917 shows the quantity, the article and the deadline once in the first view of every G1 job order', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const snapshot = g1Snapshot();
    for (const order of snapshot.productionOrders) {
      for (const jobOrder of order.jobOrders) {
        if (gantt.querySelector(`[data-block="${jobOrder.id}"]`) === null) continue;
        const panel = await openDetails(gantt, jobOrder.id);
        const deadline = formatPlantDateTime(order.deadlineMs, snapshot.plant.timeZone);
        // 1002.10 ends at its deadline: the end and the deadline are two facts with one value.
        const endsAtDeadline = jobOrder.placement?.endMs === order.deadlineMs ? 1 : 0;
        expect(countOf(panel, `${jobOrder.quantity} pcs`), jobOrder.id).toBe(1);
        expect(countOf(panel, order.article), jobOrder.id).toBe(1);
        expect(countOf(panel, deadline), `${jobOrder.id} ${deadline}`).toBe(1 + endsAtDeadline);
        await userEvent.keyboard('{Escape}');
        await waitFor(() => {
          expect(detailsOpen()).toBe(false);
        });
      }
    }
  });

  it('#917 says a late job order in the exception line, in place of the badges', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const panel = await openDetails(await findGantt(), 'jo-1003-20');

    expect(panel.querySelector('[data-exception]')?.textContent).toBe(
      'Ends 15 h 15 min after the order deadline',
    );
    expect(within(panel).queryByText('On the critical chain')).toBeNull();
    expect(within(panel).queryByText(/^Released from/)).toBeNull();
  });

  it('#917 says a locked job order in the exception line and draws no Locked badge', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const panel = await openDetails(await findGantt(), 'jo-1002-10');

    expect(panel.querySelector('[data-exception]')?.textContent).toBe(
      'Locked: keeps its machine and its start',
    );
    expect(within(panel).queryByText('Locked')).toBeNull();
  });

  it('#917 opens the Material section by itself when the shortage is the exception', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const panel = await openDetails(await findGantt(), 'jo-1004-10');

    expect(panel.querySelector('[data-exception]')?.textContent).toBe(
      'Material short: Round bar 36 C45, 26 m short at setup start',
    );
    expect(togglesOf(panel)).toEqual([
      'Constraints, 4 of 4 hold (false)',
      'Float and timing, total float 5 h 29 min 40 s (false)',
      'Material, 1 short (true)',
      'Setup and run, 30 min, 10 h (false)',
    ]);
    expect(within(panel).getByRole('region', { name: 'Material: Round bar 36 C45' })).toBeTruthy();
  });

  it('#917 opens the Constraints section by itself on a broken constraint, the broken line first', async () => {
    const snapshot = g1Snapshot();
    const analysis = snapshot.analysis.jobOrders['jo-1001-20'];
    if (analysis === undefined) throw new Error('G1 analyses 1001.20');
    const broken = {
      ...snapshot,
      analysis: {
        ...snapshot.analysis,
        jobOrders: {
          ...snapshot.analysis.jobOrders,
          'jo-1001-20': {
            ...analysis,
            constraints: analysis.constraints.map((line) =>
              line.kind === 'oneJobAtATime'
                ? {
                    ...line,
                    holds: false,
                    code: 'OVERLAP' as const,
                    text: 'One job at a time on CNC 2: overlaps 1002.10',
                  }
                : line,
            ),
          },
        },
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(broken));
    const panel = await openDetails(await findGantt(), 'jo-1001-20');

    expect(panel.querySelector('[data-exception]')?.textContent).toBe(
      'One job at a time on CNC 2: overlaps 1002.10 (OVERLAP)',
    );
    expect(togglesOf(panel)[0]).toBe('Constraints, 5 of 6 hold (true)');
    const constraints = within(panel).getByRole('region', { name: 'Constraints, 5 of 6 hold' });
    const lines = within(constraints).getAllByRole('listitem');
    expect(lines[0]?.getAttribute('data-constraint')).toBe('oneJobAtATime');
    expect(lines[0]?.getAttribute('data-holds')).toBe('false');
  });

  it('#917 toggles a section with Enter and Space, with aria-expanded on its button', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const panel = await openDetails(await findGantt(), 'jo-1001-20');

    const toggle = within(panel).getByRole('button', {
      name: 'Float and timing, total float 12 h',
    });
    expect(within(panel).queryByRole('region', { name: 'Float and timing' })).toBeNull();
    toggle.focus();
    await userEvent.keyboard('{Enter}');

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const float = within(panel).getByRole('region', { name: 'Float and timing' });
    expect(float.textContent).toContain('Wait 0 min.');
    expect(float.textContent).toContain('Starts at its release: 1001.10 end plus 1 h lead.');
    expect(float.textContent).toContain(
      'Latest start Thu 5 Nov 13:15, latest end Fri 6 Nov 15:00.',
    );

    await userEvent.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('#917 lists the actions in a menu, Lock and Split disabled with their reason', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const panel = await openDetails(await findGantt(), 'jo-1001-20');

    await userEvent.click(within(panel).getByRole('button', { name: 'Actions for 1001.20' }));
    const menu = await screen.findByRole('menu', { name: 'Actions for 1001.20' });
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.getAttribute('aria-label') ?? item.textContent)).toEqual([
      'Move',
      'Open order',
      'Show critical chain',
      'Lock',
      'Split',
    ]);
    for (const name of ['Lock', 'Split']) {
      const item = within(menu).getByRole('menuitem', { name });
      expect(item.getAttribute('aria-disabled')).toBe('true');
      const description = document.getElementById(item.getAttribute('aria-describedby') ?? '');
      expect(description?.textContent).toBe(phase1Reason);
    }
    expect(
      within(menu).getByRole('menuitem', { name: 'Move' }).getAttribute('aria-disabled'),
    ).toBeNull();
  });

  it('#917 Move in the actions menu starts the move controls in the drawer', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const panel = await openDetails(await findGantt(), 'jo-1001-20');

    await userEvent.click(within(panel).getByRole('button', { name: 'Actions for 1001.20' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move' }));

    expect(within(panel).getByRole('group', { name: 'Move 1001.20' })).toBeTruthy();
  });

  it('#917 gives the order drawer the same header, and its Why late only the cause', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await userEvent.dblClick(
      within(within(gantt).getByRole('row', { name: /^1003 / })).getByRole('rowheader'),
    );
    const panel = await findDetails();

    expect(within(panel).getByRole('heading', { level: 2 }).textContent).toBe('Order 1003');
    expect(panel.querySelector('[data-exception]')?.textContent).toBe('Late by 15 h 15 min');
    expect(within(panel).getByRole('button', { name: 'Actions for order 1003' })).toBeTruthy();
    const why = within(panel).getByRole('region', { name: 'Why late' });
    expect(why.querySelector('p')?.textContent).toBe(
      'The critical chain starts at 1001.10 on CNC 1. Show critical chain names the rows that bind it.',
    );
    expect(within(panel).queryByRole('region', { name: 'Actions' })).toBeNull();
  });
});
