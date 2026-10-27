// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { detailsOpen, findDetails, findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

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

describe('keyboard move mode on the order Gantt (plan 18, Tree grid semantics)', () => {
  it('M enters move mode; Right steps a snap then forward to working time; Down steps the machine; Enter commits and keeps focus on the block', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    rowOf(gantt, 'jo-1001-10').focus();
    await userEvent.keyboard('{ArrowRight}');
    const block = document.activeElement as HTMLElement;
    expect(block.getAttribute('data-block')).toBe('jo-1001-10');

    await userEvent.keyboard('m');
    expect(block.getAttribute('data-move-mode')).toBe('true');
    // Tue 11:30 plus the Week step of 4 h is Tue 15:30, closed, so the preview lands at Wed 06:00.
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(
        gantt.querySelector('[data-move-preview="jo-1001-10"]')?.getAttribute('data-from-ms'),
      ).toBe(String(Date.UTC(2026, 10, 4, 5)));
    });
    await waitFor(() => {
      expect(spoken()).toBe(
        'CNC 1, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it. Not saved.',
      );
    });

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(spoken()).toContain('CNC 2, Wed 4 Nov 06:00');
    });

    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(spoken()).toBe(
        '1001.10 moved to CNC 2, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it. Not saved.',
      );
    });
    expect(document.activeElement?.getAttribute('data-block')).toBe('jo-1001-10');
    expect(document.activeElement?.getAttribute('data-move-mode')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toContain('CNC 2');
    expect(screen.getByRole('button', { name: 'My draft, 2 changes' })).toBeTruthy();
  });

  it('Left steps back past the forward snap, so a row can move to an earlier shift', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    rowOf(gantt, 'jo-1001-10').focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('m');
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(
        gantt.querySelector('[data-move-preview="jo-1001-10"]')?.getAttribute('data-from-ms'),
      ).toBe(String(Date.UTC(2026, 10, 4, 5)));
    });

    // Wed 06:00 less 4 h is Wed 02:00, which snaps forward to Wed 06:00 again; the step keeps
    // going back until the preview is earlier: Tue 14:00.
    await userEvent.keyboard('{ArrowLeft}');

    await waitFor(() => {
      expect(
        gantt.querySelector('[data-move-preview="jo-1001-10"]')?.getAttribute('data-from-ms'),
      ).toBe(String(Date.UTC(2026, 10, 3, 13)));
    });
    await userEvent.keyboard('{Escape}');
  });

  it('Left on a row at its release keeps the preview there instead of walking back through the horizon', async () => {
    // 1003.20 starts at its release Wed 12:45: no earlier start exists with cascade on, so one
    // Left leaves the preview where it is, and announces no instant on the way back.
    renderGanttRoute({ zoom: 'hours', from: '2026-11-04' });
    const gantt = await findGantt();
    rowOf(gantt, 'jo-1003-20').focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('m');
    const preview = () =>
      gantt.querySelector('[data-move-preview="jo-1003-20"]')?.getAttribute('data-from-ms');
    await waitFor(() => {
      expect(preview()).toBe(String(Date.UTC(2026, 10, 4, 11, 45)));
    });
    const announced = spoken();

    await userEvent.keyboard('{ArrowLeft}');

    expect(preview()).toBe(String(Date.UTC(2026, 10, 4, 11, 45)));
    expect(spoken()).toBe(announced);
    await userEvent.keyboard('{Escape}');
  });

  it('Move in Details starts a move without dragging: Later, Next machine and Apply write the draft and focus the block', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await userEvent.click(gantt.querySelector('[data-block="jo-1001-10"]') as HTMLElement);
    const panel = await findDetails();

    await userEvent.click(within(panel).getByRole('button', { name: 'Move' }));

    const controls = within(panel).getByRole('group', { name: 'Move 1001.10' });
    await userEvent.click(within(controls).getByRole('button', { name: 'Later' }));
    await waitFor(() => {
      expect(controls.textContent).toContain(
        'CNC 1, Wed 4 Nov 06:00 to Wed 4 Nov 12:15. 1 row moves with it.',
      );
    });
    await userEvent.click(within(controls).getByRole('button', { name: 'Next machine' }));
    await waitFor(() => {
      expect(controls.textContent).toContain('CNC 2, Wed 4 Nov 06:00');
    });

    await userEvent.click(within(controls).getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(detailsOpen()).toBe(false);
    });
    expect(screen.getByRole('button', { name: 'My draft, 2 changes' })).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement?.getAttribute('data-block')).toBe('jo-1001-10');
    });
    expect(document.activeElement?.getAttribute('aria-label')).toContain('CNC 2');
  });

  it('Move in Details of a locked row is drawn disabled with the reason', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await userEvent.click(gantt.querySelector('[data-block="jo-1002-10"]') as HTMLElement);
    const panel = await findDetails();

    const move = within(panel).getByRole('button', { name: 'Move' });
    expect(move.getAttribute('aria-disabled')).toBe('true');
    expect(within(panel).getByText('Cannot move 1002.10: locked.')).toBeTruthy();
  });

  it('Escape cancels move mode and says so; a locked row refuses move mode with the reason', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    rowOf(gantt, 'jo-1003-10').focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('m');
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(gantt.querySelector('[data-move-preview="jo-1003-10"]')).not.toBeNull();
    });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(gantt.querySelector('[data-move-preview]')).toBeNull();
    });
    await waitFor(() => {
      expect(spoken()).toBe('Move cancelled.');
    });
    expect(screen.queryByRole('button', { name: /My draft, \d+ change/ })).toBeNull();

    rowOf(gantt, 'jo-1002-10').focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('m');
    await waitFor(() => {
      expect(spoken()).toBe('Cannot move 1002.10: locked.');
    });
    expect(document.activeElement?.getAttribute('data-move-mode')).toBeNull();
  });
});
