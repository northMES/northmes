// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { GanttSnapshot } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import {
  detailsOpen,
  findDetails,
  findGantt,
  renderGanttRoute,
  sourceOf,
} from './gantt-fixtures.tsx';

/** G1 with 1006.10 taken off its machine, so it sits in the Not placed row. */
function withUnplaced1006(): GanttSnapshot {
  const snapshot = g1Snapshot();
  return {
    ...snapshot,
    productionOrders: snapshot.productionOrders.map((order) =>
      order.number !== '1006'
        ? order
        : {
            ...order,
            jobOrders: order.jobOrders.map(({ equipment: _, placement: __, ...row }) => row),
          },
    ),
  };
}

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
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
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
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
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
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
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

  it('ADR0021 Escape closes the hover card that focus opened and keeps focus on the block (D3, IN2)', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    rowOf(gantt, 'jo-1001-10').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByRole('tooltip')).toBeTruthy();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(document.activeElement?.getAttribute('data-block')).toBe('jo-1001-10');
  });

  it('ADR0021 Right on an unplaced job order row lands on its time cell, named "not placed"', async () => {
    renderGanttRoute(
      { view: 'gantt', zoom: 'week', from: '2026-11-02' },
      sourceOf(withUnplaced1006()),
    );
    const gantt = await findGantt();
    expect(within(gantt).getByRole('row', { name: /Not placed/ }).textContent).toContain('1006.10');

    rowOf(gantt, 'jo-1006-10').focus();
    await userEvent.keyboard('{ArrowRight}');

    const cell = document.activeElement;
    expect(cell?.getAttribute('role')).toBe('gridcell');
    expect(cell?.getAttribute('aria-label')).toBe(
      '1006.10 Mill, Shaft 8, 600 pcs, no machine, not placed, setup 0 min, run 3 h, planned',
    );
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(rowOf(gantt, 'jo-1006-10'));
  });

  it('ADR0021 Enter opens Details of the row and selects its order', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    rowOf(gantt, 'jo-1001-20').focus();
    await userEvent.keyboard('{Enter}');

    const drawer = await findDetails();
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe('1001.20 Mill');
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ order: 'po-1001' });
    });
    await waitFor(() => {
      expect(drawer.contains(document.activeElement)).toBe(true);
    });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(detailsOpen()).toBe(false);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(rowOf(gantt, 'jo-1001-20'));
    });
  });

  it('#884 a single click on a block selects its order and leaves Details closed', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.click(gantt.querySelector('[data-block="jo-1003-20"]') as HTMLElement);

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ order: 'po-1003' });
    });
    expect(detailsOpen()).toBe(false);
  });

  it('#884 Enter on the focused block opens Details of its row, as the keyboard path of the double click', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    rowOf(gantt, 'jo-1001-20').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement?.getAttribute('data-block')).toBe('jo-1001-20');
    await userEvent.keyboard('{Enter}');

    const drawer = await findDetails();
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toBe('1001.20 Mill');
  });

  it('#884 a Shift+double click on a second order row keeps the selection and leaves Details closed', async () => {
    const user = userEvent.setup();
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await user.click(within(rowOf(gantt, 'po-1001')).getByRole('rowheader'));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ order: 'po-1001' });
    });

    await user.keyboard('{Shift>}');
    await user.dblClick(within(rowOf(gantt, 'po-1005')).getByRole('rowheader'));
    await user.keyboard('{/Shift}');

    await waitFor(() => {
      expect(rowOf(gantt, 'po-1005').getAttribute('aria-selected')).toBe('false');
    });
    expect(router.state.location.search).toMatchObject({ order: 'po-1001' });
    expect(detailsOpen()).toBe(false);
  });

  it('#884 a double click on the expand toggle of an order leaves it expanded and Details closed', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(within(gantt).getByRole('button', { name: 'Collapse order 1001' }));

    const order = within(gantt).getByRole('row', { name: /^1001 / });
    expect(order.getAttribute('aria-expanded')).toBe('true');
    expect(detailsOpen()).toBe(false);
  });

  it('#884 a double click on the row menu button leaves Details closed', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const trigger = within(gantt).getByRole('button', { name: 'Actions for order 1001' });
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    // Each click toggles the menu: the two of the double click close and reopen it.
    await userEvent.dblClick(trigger);

    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
    expect(detailsOpen()).toBe(false);
  });

  it('#884 a double click inside the hover card of a block leaves Details closed', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await userEvent.hover(gantt.querySelector('[data-block="jo-1001-20"]') as HTMLElement);
    const card = await screen.findByRole('tooltip');

    await userEvent.dblClick(card);

    expect(screen.getByRole('tooltip')).toBe(card);
    expect(detailsOpen()).toBe(false);
  });

  it('ADR0021 the close button of the Details drawer closes it and returns focus to the row', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(gantt.querySelector('[data-block="jo-1003-20"]') as HTMLElement);
    const drawer = await findDetails();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(detailsOpen()).toBe(false);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(rowOf(gantt, 'jo-1003-20'));
    });
    expect(screen.queryByRole('group', { name: 'Board panel, collapsed' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Board panel' })).toBeNull();
  });

  it('ADR0021 Escape closes the Details that a chain link opened, then ends the chain highlight', async () => {
    const router = renderGanttRoute({
      zoom: 'week',
      from: '2026-11-02',
      order: 'po-1003',
      chain: 1,
    });
    const gantt = await findGantt();
    const drawer = await findDetails();
    await waitFor(() => {
      expect(drawer.contains(document.activeElement)).toBe(true);
    });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(detailsOpen()).toBe(false);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(rowOf(gantt, 'po-1003'));
    });
    expect(router.state.location.search).toMatchObject({ chain: 1 });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        zoom: 'week',
        from: '2026-11-02',
        order: 'po-1003',
      });
    });
    expect(document.activeElement).toBe(rowOf(gantt, 'po-1003'));
  });
});
