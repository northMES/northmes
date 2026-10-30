// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createG1BoardFieldsStore } from '../../../src/modules/planning/board-fields-store.ts';
import { findDetails, findGantt, plant, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The block of a job order, by its id in the fixture. */
function blockOf(gantt: HTMLElement, id: string): HTMLElement {
  const block = gantt.querySelector<HTMLElement>(`[data-block="${id}"]`);
  if (block === null) throw new Error(`No block ${id}`);
  return block;
}

/** The labels of a description list, in order. */
function termsOf(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('dt')).map((term) => term.textContent ?? '');
}

describe('board fields on the order Gantt (plan 07, Board settings; #762)', () => {
  it("#762 draws the company's block fields: the article beside the job number, quantity and end below", async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-03' });
    const gantt = await findGantt();

    const block = blockOf(gantt, 'jo-1001-10');
    expect(block.querySelector('[data-block-line="1"]')?.textContent).toBe('1001.10 Bracket L');
    expect(block.querySelector('[data-block-line="2"]')?.textContent).toBe(
      '600 pcs, ends Wed 4 Nov 08:00',
    );
  });

  it('#762 draws the block fields Plant A saved, a module field at the trailing edge and in the name', async () => {
    const store = createG1BoardFieldsStore();
    store.save(plant, { block: ['article', 'quantity', 'slot:connector.erpChange'] });
    renderGanttRoute({ zoom: 'day', from: '2026-11-03' }, undefined, 'gantt', store);
    const gantt = await findGantt();

    const block = blockOf(gantt, 'jo-1001-10');
    expect(block.querySelector('[data-block-line="2"]')?.textContent).toBe('600 pcs');
    expect(block.querySelector('[data-block-trailing]')?.textContent).toBe('ERP change');
    expect(block.getAttribute('aria-label')).toContain(
      'pending ERP change, quantity 600 to 640 pcs',
    );
    expect(blockOf(gantt, 'jo-1002-10').querySelector('[data-block-trailing]')).toBeNull();
  });

  it("#762 lists the hover fields Plant A saved in the hover card, then the Gantt's analysis lines", async () => {
    const store = createG1BoardFieldsStore();
    store.save(plant, { hover: ['erp:DRAWING_REV', 'customer'] });
    renderGanttRoute({ zoom: 'day', from: '2026-11-03' }, undefined, 'gantt', store);
    const gantt = await findGantt();

    await userEvent.hover(blockOf(gantt, 'jo-1001-10'));

    const card = await screen.findByRole('tooltip');
    expect(termsOf(card)).toEqual([
      'DRAWING_REV',
      'Customer',
      'Working',
      'Elapsed',
      'Setup, run',
      'Free float',
      'Constraints',
    ]);
    expect(within(card).getByText('Hallberg Verkstad AB, Svea Komponent AB')).toBeTruthy();
  });

  it('#762 #917 lists every hover field in Details as well: the ones with no place above under At a glance, in the same order', async () => {
    const store = createG1BoardFieldsStore();
    store.save(plant, { hover: ['erp:SURFACE', 'slot:tooling.toolLife', 'status'] });
    renderGanttRoute({ zoom: 'day', from: '2026-11-03' }, undefined, 'gantt', store);
    const gantt = await findGantt();

    await userEvent.dblClick(blockOf(gantt, 'jo-1001-10'));

    const panel = await findDetails();
    const glance = within(panel).getByRole('region', { name: 'At a glance' });
    expect(termsOf(glance)).toEqual([
      'Machine',
      'Time',
      'Deadline',
      'Customer',
      'SURFACE',
      'Tool life',
      'After',
    ]);
    expect(within(glance).getByText('T-311, 1 840 pcs left')).toBeTruthy();
    // Status shows as the header's badge.
    expect(within(panel).getByText('Planned')).toBeTruthy();
  });
});
