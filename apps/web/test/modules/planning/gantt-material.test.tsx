// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { findDetails, findGantt, plant, renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The block of a job order, by its id in the fixture. */
function blockOf(gantt: HTMLElement, id: string): HTMLElement {
  const block = gantt.querySelector<HTMLElement>(`[data-block="${id}"]`);
  if (block === null) throw new Error(`No block ${id}`);
  return block;
}

describe('the material warning on the order Gantt (plan 07, Material warnings; design #729, MW1 to MW3)', () => {
  it('#729 MW1 marks 1004.10 material short with the cue and its words, and not 1004.20', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const short = blockOf(gantt, 'jo-1004-10');
    expect(short.getAttribute('data-states')).toContain('material');
    expect(short.getAttribute('aria-label')).toMatch(
      /, material short: Round bar 36 C45, 26 m short at setup start$/,
    );
    expect(short.querySelector('[data-material-cue]')).not.toBeNull();
    const next = blockOf(gantt, 'jo-1004-20');
    expect(next.getAttribute('data-states') ?? '').not.toContain('material');
    expect(next.querySelector('[data-material-cue]')).toBeNull();
  });

  it('#729 MW1 badges the order row and the job order row, so a collapsed tree still shows it', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    const order = within(gantt).getByRole('row', { name: /^1004 / });
    expect(within(order).getByText('Material short')).toBeTruthy();
    const jobOrder = within(gantt).getByRole('row', { name: /^1004\.10 / });
    expect(within(jobOrder).getByText('Material short')).toBeTruthy();
    expect(
      within(within(gantt).getByRole('row', { name: /^1003 / })).queryByText('Material short'),
    ).toBeNull();
  });

  it('#729 MW1 adds the material line to the hover card', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.hover(blockOf(gantt, 'jo-1004-10'));

    const card = await screen.findByRole('tooltip');
    expect(within(card).getByText('Material short').nextElementSibling?.textContent).toBe(
      'Round bar 36 C45 26 m short at setup start',
    );
  });

  it('#729 MW3 explains the shortage in the Material section of Details, with Show stock', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(blockOf(gantt, 'jo-1004-10'));
    const panel = await findDetails();
    const material = within(panel).getByRole('region', { name: 'Material: Round bar 36 C45' });

    expect(material.textContent).toContain(
      'Round bar 36 C45 30-2011 is 26 m short at the setup start, Thu 5 Nov 06:00.',
    );
    expect(material.textContent).toContain('Needs102 m (0.085 m per piece)');
    expect(material.textContent).toContain('Projected then76 m in Plant A');
    expect(material.textContent).toContain('Shortfall26 m');
    expect(material.textContent).toContain('FromA-RM Raw materials A');
    expect(material.textContent).toContain(
      "Caused by this job order's consumption of 102 m, which takes Plant A's projected balance from 76 m to −26 m. Before it, 1003.10 consumes 36 m on Wed 4 Nov 08:00.",
    );
    expect(material.textContent).toContain(
      'Next incoming: Purchase order 7740, +120 m, Mon 9 Nov. Purchase requisition 3301, +60 m on Fri 6 Nov, is not counted (Plant A setting).',
    );
    expect(
      within(material)
        .getByRole('link', { name: 'Show stock of Round bar 36 C45' })
        .getAttribute('href'),
    ).toBe(planningLinks.stock.article({ plant, articleId: '30-2011' }).href);
  });

  it('#729 MW3 shows no Material section on a job order whose material holds', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    await userEvent.dblClick(blockOf(gantt, 'jo-1003-10'));
    const panel = await findDetails();
    expect(within(panel).queryByRole('region', { name: /^Material/ })).toBeNull();
  });

  it('#729 draws no warning from a snapshot without stock, as a server source without it answers', async () => {
    const { stock: _, ...withoutStock } = g1Snapshot();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(withoutStock));
    const gantt = await findGantt();

    expect(blockOf(gantt, 'jo-1004-10').querySelector('[data-material-cue]')).toBeNull();
    expect(within(gantt).queryByText('Material short')).toBeNull();
  });

  it('#729 MW1 names every material an operation is short of, one Material section each', async () => {
    const snapshot = g1Snapshot();
    const stock = snapshot.stock;
    if (stock === undefined) throw new Error('G1 carries stock');
    const twoMaterials = {
      ...snapshot,
      stock: {
        ...stock,
        operationMaterials: [
          ...stock.operationMaterials,
          {
            article: 'Hub 12',
            sequence: 10,
            material: '30-2030',
            perPiece: 0.1,
            warehouse: 'A-RM',
          },
        ],
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(twoMaterials));
    const gantt = await findGantt();

    expect(blockOf(gantt, 'jo-1004-10').getAttribute('aria-label')).toMatch(
      /material short: Round bar 36 C45, 26 m short at setup start, material short: Steel tube 52x6, 50 m short at setup start$/,
    );
    await userEvent.dblClick(blockOf(gantt, 'jo-1004-10'));
    const panel = await findDetails();
    expect(within(panel).getAllByRole('region', { name: /^Material: / })).toHaveLength(2);
  });

  it('#729 MW1 says the setup start has passed when the consumption counts at now', async () => {
    const later = { ...g1Snapshot(), nowMs: Date.parse('2026-11-05T07:00:00Z') };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, sourceOf(later));
    const gantt = await findGantt();

    expect(blockOf(gantt, 'jo-1004-10').getAttribute('aria-label')).toMatch(
      /material short: Round bar 36 C45, 26 m short now, its setup start has passed$/,
    );
  });

  it('#729 MW1 clears the warning when a draft move takes 1004.10 past the incoming purchase, and says so', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    await userEvent.dblClick(blockOf(gantt, 'jo-1004-10'));
    const panel = await findDetails();

    await userEvent.click(within(panel).getByRole('button', { name: 'Move' }));
    const controls = within(panel).getByRole('group', { name: 'Move 1004.10' });
    // Later until the move starts on Monday, after purchase order 7740 arrives.
    const startsMonday = () => /CNC \d, Mon 9 Nov/.test(controls.textContent ?? '');
    for (let step = 0; step < 8 && !startsMonday(); step += 1) {
      await userEvent.click(within(controls).getByRole('button', { name: 'Later' }));
    }
    expect(startsMonday()).toBe(true);
    await userEvent.click(within(controls).getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(blockOf(gantt, 'jo-1004-10').querySelector('[data-material-cue]')).toBeNull(),
    );
    expect(within(gantt).queryByText('Material short')).toBeNull();
    // The move's own message comes first; the warning that cleared is said after it.
    await waitFor(() =>
      expect(document.getElementById('announcer-polite')?.textContent).toBe(
        'No longer material short: 1004.10.',
      ),
    );
  });
});
