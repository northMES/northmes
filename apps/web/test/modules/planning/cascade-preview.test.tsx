// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { detailsOpen, findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('northmes.planning.gantt.options');
});

/** The block of a job order, which is its drag target. */
function blockOf(gantt: HTMLElement, jobOrderId: string): HTMLElement {
  const block = gantt.querySelector<HTMLElement>(`[data-block="${jobOrderId}"]`);
  if (block === null) throw new Error(`No block ${jobOrderId}`);
  return block;
}

/** The x of a block's left edge on the time axis, from its style. */
function leftOf(block: HTMLElement): number {
  return Number.parseFloat(block.style.left);
}

/**
 * Drags a block by pointer to where another instant lies: the axis has no layout in the test
 * browser, so the pointer's travel is the difference of the two blocks' left edges.
 */
function drag(block: HTMLElement, dx: number, options: { readonly drop?: boolean } = {}) {
  fireEvent.pointerDown(block, {
    clientX: 100,
    clientY: 10,
    pointerId: 1,
    button: 0,
    isPrimary: true,
  });
  fireEvent.pointerMove(block, { clientX: 100 + dx / 2, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(block, { clientX: 100 + dx, clientY: 10, pointerId: 1 });
  if (options.drop !== false) {
    fireEvent.pointerUp(block, { clientX: 100 + dx, clientY: 10, pointerId: 1, button: 0 });
  }
}

// At Day zoom the snap step is 1 h, so the GT3 drop at Wed 09:00 lies on the grid.
describe('the cascade preview of a pointer move (plan 18, Cascade rule 8)', () => {
  it('GT3 dragging 1003.10 to Wed 09:00 shows one ghost span at Wed 13:30 and the tooltip "+1 row moves"', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    // 1001.20 starts Wed 09:00: its left edge is where 1003.10 is dragged to.
    const dx = leftOf(blockOf(gantt, 'jo-1001-20')) - leftOf(blockOf(gantt, 'jo-1003-10'));

    drag(blockOf(gantt, 'jo-1003-10'), dx, { drop: false });

    const ghost = await waitFor(() => {
      const found = gantt.querySelector<HTMLElement>('[data-ghost="jo-1003-20"]');
      if (found === null) throw new Error('no ghost yet');
      return found;
    });
    expect(ghost.getAttribute('data-from-ms')).toBe(String(Date.UTC(2026, 10, 4, 12, 30)));
    expect(ghost.getAttribute('data-to-ms')).toBe(String(Date.UTC(2026, 10, 5, 6)));
    const tooltip = gantt.querySelector('[data-drag-tooltip]');
    expect(tooltip?.textContent).toContain('+1 row moves');
    expect(tooltip?.textContent).toContain('Wed 4 Nov 09:00');
    const preview = gantt.querySelector<HTMLElement>('[data-move-preview="jo-1003-10"]');
    expect(preview?.getAttribute('data-from-ms')).toBe(String(Date.UTC(2026, 10, 4, 8)));

    fireEvent.pointerUp(blockOf(gantt, 'jo-1003-10'), {
      clientX: 100 + dx,
      clientY: 10,
      pointerId: 1,
      button: 0,
    });
    // The click a browser fires after the drop is not a selection: Details stays closed.
    fireEvent.click(blockOf(gantt, 'jo-1003-10'));

    await waitFor(() => {
      expect(blockOf(gantt, 'jo-1003-10').getAttribute('data-states')).toContain('draft');
    });
    expect(detailsOpen()).toBe(false);
    expect(blockOf(gantt, 'jo-1003-20').getAttribute('data-states')).toContain('draft');
    expect(blockOf(gantt, 'jo-1003-10').getAttribute('aria-label')).toContain(
      'changed in your draft, not saved',
    );
    expect(gantt.querySelector('[data-ghost]')).toBeNull();
    expect(screen.getByRole('button', { name: 'My draft, 2 changes' })).toBeTruthy();
  });

  it('with cascade off the preview shows no ghost and the drop writes one change', async () => {
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ cascade: false }),
    );
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    const dx = leftOf(blockOf(gantt, 'jo-1001-20')) - leftOf(blockOf(gantt, 'jo-1003-10'));

    drag(blockOf(gantt, 'jo-1003-10'), dx, { drop: false });

    await waitFor(() => {
      expect(gantt.querySelector('[data-move-preview="jo-1003-10"]')).not.toBeNull();
    });
    expect(gantt.querySelector('[data-ghost]')).toBeNull();
    expect(gantt.querySelector('[data-drag-tooltip]')?.textContent).not.toContain('row moves');

    fireEvent.pointerUp(blockOf(gantt, 'jo-1003-10'), {
      clientX: 100 + dx,
      clientY: 10,
      pointerId: 1,
      button: 0,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'My draft, 1 change' })).toBeTruthy();
    });
    expect(blockOf(gantt, 'jo-1003-20').getAttribute('data-states')).toContain('conflict');
  });

  it('a drop before the release snaps to it and says so; Escape during a drag cancels it', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    // 1003.20 dragged back to where 1001.20 starts, Wed 09:00, before its release at Wed 12:45.
    const dx = leftOf(blockOf(gantt, 'jo-1001-20')) - leftOf(blockOf(gantt, 'jo-1003-20'));

    drag(blockOf(gantt, 'jo-1003-20'), dx, { drop: false });
    await waitFor(() => {
      expect(gantt.querySelector('[data-drag-tooltip]')?.textContent).toContain(
        'snapped to release from 1003.10',
      );
    });
    fireEvent.keyDown(blockOf(gantt, 'jo-1003-20'), { key: 'Escape' });

    await waitFor(() => {
      expect(gantt.querySelector('[data-move-preview]')).toBeNull();
    });
    expect(screen.queryByRole('button', { name: /My draft, \d+ change/ })).toBeNull();
    expect(blockOf(gantt, 'jo-1003-20').getAttribute('data-states') ?? '').not.toContain('draft');
  });
});
