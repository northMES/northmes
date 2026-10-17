// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderBoardRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The row id of the focused element, or of the row that holds it. */
function focusedRowId(): string | null | undefined {
  const active = document.activeElement;
  return active?.closest('[role="row"]')?.getAttribute('data-row-id');
}

/** The row with this id. */
function rowOf(gantt: HTMLElement, id: string): HTMLElement {
  const row = gantt.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
  if (row === null) throw new Error(`No row ${id}`);
  return row;
}

describe('row focus mode of the order Gantt (plan 18, Tree grid semantics)', () => {
  it('ADR0021 one row holds the tab stop; Up and Down move between rows, Home and End to the first and last', async () => {
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const rows = within(gantt)
      .getAllByRole('row')
      .filter((row) => row.hasAttribute('data-row-id'));
    expect(rows.filter((row) => row.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(rows[0]?.getAttribute('tabindex')).toBe('0');

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    rowOf(gantt, 'po-1003').focus();
    expect(focusedRowId()).toBe('po-1003');
    await userEvent.keyboard('{ArrowDown}');
    expect(focusedRowId()).toBe('op-1003.10');
    await userEvent.keyboard('{ArrowDown}');
    expect(focusedRowId()).toBe('jo-1003-10');
    expect(rowOf(gantt, 'jo-1003-10').getAttribute('tabindex')).toBe('0');
    expect(rowOf(gantt, 'po-1003').getAttribute('tabindex')).toBe('-1');
    await userEvent.keyboard('{ArrowUp}');
    expect(focusedRowId()).toBe('op-1003.10');
    await userEvent.keyboard('{End}');
    expect(focusedRowId()).toBe('jo-1006-10');
    await userEvent.keyboard('{Home}');
    expect(focusedRowId()).toBe('po-1003');
    await userEvent.keyboard('{ArrowUp}');
    expect(focusedRowId()).toBe('po-1003');
  });

  it('ADR0021 Left collapses an expanded row, Right expands it, Left on a leaf row goes to its parent', async () => {
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    rowOf(gantt, 'po-1003').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(rowOf(gantt, 'po-1003').getAttribute('aria-expanded')).toBe('false');
    expect(gantt.querySelector('[data-row-id="op-1003.10"]')).toBeNull();
    await userEvent.keyboard('{ArrowDown}');
    expect(focusedRowId()).toBe('po-1002');
    await userEvent.keyboard('{ArrowUp}{ArrowRight}');
    expect(rowOf(gantt, 'po-1003').getAttribute('aria-expanded')).toBe('true');
    expect(focusedRowId()).toBe('po-1003');

    rowOf(gantt, 'jo-1003-20').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(focusedRowId()).toBe('op-1003.20');
  });

  it('ADR0021 Right on an expanded row moves into its time cell and Left comes back to the row', async () => {
    renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    rowOf(gantt, 'po-1001').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Order 1001, Tue 3 Nov 11:30 to Thu 5 Nov 10:45, on time',
    );
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(rowOf(gantt, 'po-1001'));

    rowOf(gantt, 'jo-1001-20').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement?.getAttribute('data-block')).toBe('jo-1001-20');
    expect(await screen.findByRole('tooltip')).toBeTruthy();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(rowOf(gantt, 'jo-1001-20'));
  });

  it('ADR0021 Enter opens Details of the row and selects its order', async () => {
    const router = renderBoardRoute({ view: 'gantt', zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    rowOf(gantt, 'jo-1001-20').focus();
    await userEvent.keyboard('{Enter}');

    const panel = screen.getByRole('complementary', { name: 'Board panel' });
    expect(within(panel).getByRole('heading', { level: 2 }).textContent).toBe('1001.20 Mill');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ order: 'po-1001' });
    });
    expect(document.activeElement).toBe(rowOf(gantt, 'jo-1001-20'));
  });

  it('ADR0021 Escape ends the chain highlight first, then closes the docked panel', async () => {
    const router = renderBoardRoute({
      view: 'gantt',
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    const gantt = await findGantt();
    expect(screen.getByRole('complementary', { name: 'Board panel' })).toBeTruthy();

    rowOf(gantt, 'po-1003').focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        view: 'gantt',
        zoom: 'week',
        from: '2026-11-02',
        order: 'po-1003',
      });
    });
    expect(screen.getByRole('complementary', { name: 'Board panel' })).toBeTruthy();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('complementary', { name: 'Board panel' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Board panel, collapsed' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Expand panel' }));
    expect(screen.getByRole('complementary', { name: 'Board panel' })).toBeTruthy();
  });
});
