// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, cleanup, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createG1PlanningRulesStore } from '../../../src/modules/planning/planning-rules-store.ts';
import { findGantt, markerTexts, plant, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The frozen band's text on the Gantt's overlay. */
function frozenBand(gantt: HTMLElement): string[] {
  const overlay = gantt.querySelector<HTMLElement>('[data-overlay]');
  if (overlay === null) throw new Error('No overlay');
  return markerTexts(overlay, 'frozen');
}

describe("the order Gantt draws a plant's planning rules as saved (#766)", () => {
  it('a frozen window of 48 h draws the frozen band from now to Wed 4 Nov 09:40', async () => {
    const rules = createG1PlanningRulesStore();
    rules.save(plant, { frozenHours: 48 });
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'gantt', undefined, rules);
    const gantt = await findGantt();

    expect(frozenBand(gantt)).toEqual(['frozen window, Mon 2 Nov 09:40 to Wed 4 Nov 09:40']);
  });

  it('the deadline rule start of day puts the deadline of a date-only order at 00:00', async () => {
    const rules = createG1PlanningRulesStore();
    rules.save(plant, { deadlineRule: 'startOfDay' });
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'gantt', undefined, rules);
    const gantt = await findGantt();

    const row = within(gantt).getByRole('row', { name: /^1001 / });
    expect(markerTexts(row, 'deadline')).toEqual(['deadline Fri 6 Nov 00:00']);
  });

  it('a Save on the planning rules shows on an open Gantt without a reload', async () => {
    const rules = createG1PlanningRulesStore();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'gantt', undefined, rules);
    const gantt = await findGantt();
    expect(frozenBand(gantt)).toEqual(['frozen window, Mon 2 Nov 09:40 to Tue 3 Nov 09:40']);

    act(() => rules.save(plant, { frozenHours: 0 }));
    await waitFor(async () => expect(frozenBand(await findGantt())).toEqual([]));
  });
});
