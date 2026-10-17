// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('northmes.planning.gantt.options');
});

/** The row with this id. */
function rowOf(gantt: HTMLElement, id: string): HTMLElement {
  const row = gantt.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
  if (row === null) throw new Error(`No row ${id}`);
  return row;
}

/** Moves 1003.10 one Day snap step later, Wed 08:00 to Wed 09:00 (GT3), through keyboard move mode. */
async function moveLaterByKeyboard(gantt: HTMLElement) {
  rowOf(gantt, 'jo-1003-10').focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement?.getAttribute('data-block')).toBe('jo-1003-10');
  await userEvent.keyboard('m');
  await userEvent.keyboard('{ArrowRight}');
  await userEvent.keyboard('{Enter}');
}

describe('the My draft list (plan 18, Resolving a break in the draft)', () => {
  it('GT3 after a move with cascade off, My draft lists one LEAD_TIME line with the clearing instant, and Cascade from here resolves it', async () => {
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ cascade: false }),
    );
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();

    await moveLaterByKeyboard(gantt);

    const open = await screen.findByRole('button', { name: 'My draft, 1 change' });
    await userEvent.click(open);
    const drawer = await screen.findByRole('dialog', { name: /My draft/ });
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe(
      'My draft, 1 change',
    );
    const conflicts = within(drawer).getByRole('list', { name: '1 conflict in your draft' });
    const [line] = within(conflicts).getAllByRole('listitem');
    expect(line?.textContent).toContain(
      '1003.20 starts 45 min before its release from 1003.10; clears at Wed 4 Nov 13:30',
    );
    expect(line?.textContent).toContain('LEAD_TIME');
    const save = within(drawer).getByRole('button', { name: 'Save changes' });
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(within(drawer).getByText('Saving needs the plan server.')).toBeTruthy();

    await userEvent.click(
      within(line as HTMLElement).getByRole('button', { name: 'Cascade from here' }),
    );

    await waitFor(() => {
      expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe(
        'My draft, 2 changes',
      );
    });
    expect(within(drawer).queryByRole('list', { name: /conflict/ })).toBeNull();
    expect(within(drawer).getByText('No conflicts in your draft')).toBeTruthy();
    const changes = within(drawer).getByRole('list', { name: 'Changes' });
    expect(
      within(changes)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('data-draft-row')),
    ).toEqual(['jo-1003-10', 'jo-1003-20']);
  });

  it('Move back discards the change, and Discard draft empties the draft', async () => {
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ cascade: false }),
    );
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    await moveLaterByKeyboard(gantt);
    await userEvent.click(await screen.findByRole('button', { name: 'My draft, 1 change' }));
    const drawer = await screen.findByRole('dialog', { name: /My draft/ });

    await userEvent.click(within(drawer).getByRole('button', { name: 'Move back' }));

    await waitFor(() => {
      expect(within(drawer).getByText('No changes in your draft')).toBeTruthy();
    });
    expect(
      gantt.querySelector('[data-block="jo-1003-10"]')?.getAttribute('data-states') ?? '',
    ).not.toContain('draft');

    await userEvent.keyboard('{Escape}');
    await moveLaterByKeyboard(gantt);
    await userEvent.click(await screen.findByRole('button', { name: 'My draft, 1 change' }));
    const again = await screen.findByRole('dialog', { name: /My draft/ });
    await userEvent.click(within(again).getByRole('button', { name: 'Discard draft' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard 1 change' }));
    await waitFor(() => {
      expect(within(again).getByText('No changes in your draft')).toBeTruthy();
    });
  });
});
