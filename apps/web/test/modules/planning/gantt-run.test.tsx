// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { findDetails, findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('northmes.planning.gantt.options');
});

function rowOf(gantt: HTMLElement, id: string): HTMLElement {
  const row = gantt.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
  if (row === null) throw new Error(`No row ${id}`);
  return row;
}

/** What the polite live region says. */
function spoken(): string {
  return document.getElementById('announcer-polite')?.textContent ?? '';
}

/** The review step, once it has opened. */
async function findReview(): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: 'Combine into a run' });
}

/** Selects 1001 and 1005 with a click and a Shift+click. */
async function selectBoth(gantt: HTMLElement): Promise<void> {
  await userEvent.click(within(rowOf(gantt, 'po-1001')).getByRole('rowheader'));
  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('{Shift>}');
  await userEvent.click(within(rowOf(gantt, 'po-1005')).getByRole('rowheader'));
  await userEvent.keyboard('{/Shift}');
}

describe('runs of orders of one article on the order Gantt (ADR 0083, plan 18 Runs)', () => {
  it('Shift+click selects a second order row, and the row menu offers Combine into a run for two orders of one article', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await selectBoth(gantt);

    expect(rowOf(gantt, 'po-1001').getAttribute('aria-selected')).toBe('true');
    expect(rowOf(gantt, 'po-1005').getAttribute('aria-selected')).toBe('true');
    expect(rowOf(gantt, 'po-1003').getAttribute('aria-selected')).toBe('false');
    expect(router.state.location.search).toMatchObject({ order: 'po-1001' });

    await userEvent.click(
      within(rowOf(gantt, 'po-1005')).getByRole('button', { name: 'Actions for order 1005' }),
    );
    const menu = await screen.findByRole('menu', { name: 'Actions for order 1005' });
    const combine = within(menu).getByRole('menuitem', { name: 'Combine into a run' });
    expect(combine.getAttribute('aria-disabled')).toBeNull();
    await userEvent.keyboard('{Escape}');
  });

  it('with one order selected the item is disabled and says which order to add; with two articles it says so', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', order: 'po-1001' });
    const gantt = await findGantt();

    await userEvent.click(
      within(rowOf(gantt, 'po-1001')).getByRole('button', { name: 'Actions for order 1001' }),
    );
    let menu = await screen.findByRole('menu', { name: 'Actions for order 1001' });
    expect(
      within(menu).getByRole('menuitem', { name: 'Combine into a run' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(menu.textContent).toContain('Select another order of Bracket L');
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('{Shift>}');
    await userEvent.click(within(rowOf(gantt, 'po-1003')).getByRole('rowheader'));
    await userEvent.keyboard('{/Shift}');
    await userEvent.click(
      within(rowOf(gantt, 'po-1003')).getByRole('button', { name: 'Actions for order 1003' }),
    );
    menu = await screen.findByRole('menu', { name: 'Actions for order 1003' });
    expect(menu.textContent).toContain('The selected orders are of different articles');
    await userEvent.keyboard('{Escape}');
  });

  it('GT10 the review step lists the orders, the saved setup, the deadline with the early warning, the span and the break; Combine draws the run above its orders', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await selectBoth(gantt);
    await userEvent.click(
      within(rowOf(gantt, 'po-1005')).getByRole('button', { name: 'Actions for order 1005' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Combine into a run' }));

    const review = await findReview();
    expect(within(review).getByRole('list', { name: 'Orders' }).textContent).toContain(
      '1001, 600 pcs, due Fri 6 Nov 15:00, from the ERP',
    );
    expect(within(review).getByRole('list', { name: 'Orders' }).textContent).toContain(
      '1005, 600 pcs, due Fri 13 Nov 15:00, NorthMES',
    );
    expect(within(review).getByRole('list', { name: 'Saved setups' }).textContent).toBe(
      '1005.10 follows 1001.10 on CNC 1, saves 30 min',
    );
    expect(review.textContent).toContain('The run is due Fri 6 Nov 15:00, the deadline of 1001.');
    expect(review.textContent).toContain(
      '1005 is due Fri 13 Nov 15:00; the run is due 7 days earlier.',
    );
    expect(review.textContent).toContain(
      'Tue 3 Nov 11:30 to Mon 9 Nov 07:45, late by 2 days 16 h 45 min',
    );
    expect(within(review).getByRole('list', { name: 'Breaks' }).textContent).toBe(
      '1003.10 and 1005.10 overlap on the same machine (OVERLAP)',
    );

    await userEvent.click(within(review).getByRole('button', { name: 'Combine' }));

    await waitFor(() => {
      expect(spoken()).toBe(
        'Run of Bracket L in your draft: 1001 and 1005, 2 rows moved, 1 setup saved. Not saved.',
      );
    });
    const run = rowOf(gantt, 'run:po-1001+po-1005');
    expect(run.getAttribute('aria-level')).toBe('1');
    expect(run.getAttribute('aria-expanded')).toBe('true');
    expect(within(run).getByRole('rowheader').textContent).toContain('Run of Bracket L');
    expect(within(run).getByRole('rowheader').textContent).toContain('late by 2 days 16 h 45 min');
    expect(within(run).getByRole('gridcell', { name: /^Run of Bracket L, / }).getAttribute('aria-label')).toBe(
      'Run of Bracket L, 1001 and 1005, Tue 3 Nov 11:30 to Mon 9 Nov 07:45, late by 2 days 16 h 45 min',
    );
    expect(run.querySelector('[data-summary-bar][data-run]')).not.toBeNull();
    expect(rowOf(gantt, 'po-1001').getAttribute('aria-level')).toBe('2');
    expect(rowOf(gantt, 'po-1005').getAttribute('aria-level')).toBe('2');
    expect(within(rowOf(gantt, 'po-1005')).getByRole('rowheader').textContent).toContain(
      'early by 7 days',
    );
    expect(rowOf(gantt, 'jo-1005-10').getAttribute('aria-level')).toBe('4');
    // The level 1 rows in the autoplan order: the run takes 1001's deadline and priority.
    expect(
      Array.from(gantt.querySelectorAll('[role="row"][aria-level="1"]')).map((row) =>
        row.getAttribute('data-row-id'),
      ),
    ).toEqual(['po-1003', 'po-1002', 'run:po-1001+po-1005', 'po-1004', 'po-1006']);

    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1005-10"]');
    expect(block?.querySelector('[data-setup-hatch]')).toBeNull();
    expect(block?.getAttribute('aria-label')).toContain('Wed 4 Nov 08:00 to Wed 4 Nov 13:45');
    expect(block?.getAttribute('aria-label')).toContain('setup saved by the run (30 min), run 5 h');
    expect(block?.getAttribute('aria-label')).toContain('changed in your draft');
    expect(screen.getByRole('button', { name: 'My draft, 1 change' })).toBeTruthy();
  });

  it('GT10 the My draft drawer lists the run as one change with Split run, which removes the run and its moves', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await selectBoth(gantt);
    await userEvent.click(
      within(rowOf(gantt, 'po-1001')).getByRole('button', { name: 'Actions for order 1001' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Combine into a run' }));
    await userEvent.click(within(await findReview()).getByRole('button', { name: 'Combine' }));
    await screen.findByRole('button', { name: 'My draft, 1 change' });

    await userEvent.click(screen.getByRole('button', { name: 'My draft, 1 change' }));
    const drawer = await screen.findByRole('dialog', { name: 'My draft, 1 change' });
    const runs = within(drawer).getByRole('list', { name: 'Runs' });
    expect(runs.textContent).toContain('Run of Bracket L: 1001 and 1005, 2 rows moved, 1 setup saved');
    expect(within(drawer).queryByRole('list', { name: 'Changes' })).toBeNull();
    expect(
      within(drawer).getByRole('list', { name: '1 conflict in your draft' }).textContent,
    ).toContain('1003.10 and 1005.10 overlap on the same machine');

    await userEvent.click(within(runs).getByRole('button', { name: 'Split run' }));

    await waitFor(() => {
      expect(spoken()).toBe('Run of Bracket L split; 1001 and 1005 are separate orders again.');
    });
    expect(gantt.querySelector('[data-row-id="run:po-1001+po-1005"]')).toBeNull();
    expect(rowOf(gantt, 'po-1005').getAttribute('aria-level')).toBe('1');
    expect(screen.getByRole('button', { name: 'My draft' })).toBeTruthy();
  });

  it('Space selects the focused order row, Shift+Space adds one, and Shift+F10 opens its menu; Details offers Combine into a run', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    rowOf(gantt, 'po-1001').focus();
    await userEvent.keyboard(' ');
    expect(rowOf(gantt, 'po-1001').getAttribute('aria-selected')).toBe('true');
    rowOf(gantt, 'po-1005').focus();
    await userEvent.keyboard('{Shift>} {/Shift}');
    expect(rowOf(gantt, 'po-1001').getAttribute('aria-selected')).toBe('true');
    expect(rowOf(gantt, 'po-1005').getAttribute('aria-selected')).toBe('true');

    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    const menu = await screen.findByRole('menu', { name: 'Actions for order 1005' });
    expect(within(menu).getByRole('menuitem', { name: 'Combine into a run' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');

    rowOf(gantt, 'po-1005').focus();
    await userEvent.keyboard('{Enter}');
    const details = await findDetails();
    await userEvent.click(within(details).getByRole('button', { name: 'Combine into a run' }));
    expect(await findReview()).toBeTruthy();
    await userEvent.click(within(await findReview()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Combine into a run' })).toBeNull();
    });
  });

  it('the run row has Details with Split run and a menu with Split run', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await selectBoth(gantt);
    await userEvent.click(
      within(rowOf(gantt, 'po-1001')).getByRole('button', { name: 'Actions for order 1001' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Combine into a run' }));
    await userEvent.click(within(await findReview()).getByRole('button', { name: 'Combine' }));
    const run = await waitFor(() => rowOf(gantt, 'run:po-1001+po-1005'));

    await userEvent.click(
      within(run).getByRole('button', { name: 'Actions for the run of Bracket L' }),
    );
    const menu = await screen.findByRole('menu', { name: 'Actions for the run of Bracket L' });
    expect(within(menu).getByRole('menuitem', { name: 'Split run' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');

    run.focus();
    await userEvent.keyboard('{Enter}');
    const details = await findDetails();
    expect(within(details).getByRole('heading', { level: 2 }).textContent).toBe('Run of Bracket L');
    expect(details.textContent).toContain('1005.10 follows 1001.10 on CNC 1, saves 30 min');
    await userEvent.click(within(details).getByRole('button', { name: 'Split run' }));
    await waitFor(() => {
      expect(gantt.querySelector('[data-row-id="run:po-1001+po-1005"]')).toBeNull();
    });
  });
});
