// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The block of a job order, by its id in the fixture. */
function blockOf(gantt: HTMLElement, id: string): HTMLElement {
  const block = gantt.querySelector<HTMLElement>(`[data-block="${id}"]`);
  if (block === null) throw new Error(`No block ${id}`);
  return block;
}

describe('the block of a job order row (plan 18, Blocks across closed time)', () => {
  it('GT7 draws 1006.10 as one block with one hollow segment from Fri 15:00 to Mon 06:00', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const block = blockOf(gantt, 'jo-1006-10');
    expect(block.getAttribute('aria-label')).toBe(
      '1006.10 Mill, Shaft 8, 600 pcs, Mill 1, Fri 6 Nov 13:00 to Mon 9 Nov 07:00, setup 0 min, run 3 h, planned',
    );
    const hollows = block.querySelectorAll('[data-hollow]');
    expect(hollows).toHaveLength(1);
    expect(hollows[0]?.getAttribute('data-from-ms')).toBe(String(Date.UTC(2026, 10, 6, 14, 0)));
    expect(hollows[0]?.getAttribute('data-to-ms')).toBe(String(Date.UTC(2026, 10, 9, 5, 0)));
    expect(blockOf(gantt, 'jo-1002-10').querySelectorAll('[data-hollow]')).toHaveLength(0);
  });

  it('GT1 hatches the setup part of a block that is at least 66 px wide and names setup and run', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const withSetup = blockOf(gantt, 'jo-1004-10');
    const hatch = withSetup.querySelector<HTMLElement>('[data-setup-hatch]');
    expect(hatch).not.toBeNull();
    expect(Number.parseFloat(hatch?.style.width ?? '0')).toBeGreaterThan(0);
    expect(withSetup.getAttribute('aria-label')).toContain('setup 30 min, run 10 h');
    expect(blockOf(gantt, 'jo-1001-20').querySelector('[data-setup-hatch]')).toBeNull();
  });

  it('GT1 draws no setup hatch on a block narrower than 66 px', async () => {
    renderGanttRoute({ zoom: '4weeks', from: '2026-11-02' });
    const gantt = await findGantt();

    const block = blockOf(gantt, 'jo-1001-10');
    expect(Number.parseFloat(block.style.width)).toBeLessThan(66);
    expect(block.querySelector('[data-setup-hatch]')).toBeNull();
  });

  it('GT7 opens the hover card on hover with both durations, "3 h working" and "66 h elapsed"', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.hover(blockOf(gantt, 'jo-1006-10'));

    const card = await screen.findByRole('tooltip');
    expect(within(card).getByText('3 h working')).toBeTruthy();
    expect(within(card).getByText('66 h elapsed')).toBeTruthy();
    expect(within(card).getByText('Fri 6 Nov 13:00')).toBeTruthy();
    expect(within(card).getByText('4 hold')).toBeTruthy();
  });

  it('GT1 names a locked operation and a late order on their blocks', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(blockOf(gantt, 'jo-1002-10').getAttribute('aria-label')).toContain(', locked');
    expect(blockOf(gantt, 'jo-1003-20').getAttribute('aria-label')).toContain(
      'released from 1003.10 at Wed 4 Nov 12:45, starts on time, late by 15 h 15 min',
    );
    expect(blockOf(gantt, 'jo-1002-10').getAttribute('data-states')).toBe('locked');
  });

  // The 3 px bar the selected mark draws, and the D1 block text in pure black in both themes, are
  // read from computed style in e2e/design-rules.spec.ts.
  it('GT1 marks every block of the selected order as selected, which draws the 3 px selection bar', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', order: 'po-1001' });
    const gantt = await findGantt();

    expect(blockOf(gantt, 'jo-1001-10').getAttribute('data-selected')).toBe('true');
    expect(blockOf(gantt, 'jo-1001-20').getAttribute('data-selected')).toBe('true');
    expect(blockOf(gantt, 'jo-1003-10').getAttribute('data-selected')).toBeNull();
  });
});
