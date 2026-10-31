// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import {
  buildGanttRows,
  fitTargetOf,
  type GanttRow,
  selectionRowOf,
} from '../../../src/modules/planning/screens/gantt/gantt-rows.ts';

const rows = buildGanttRows(g1Snapshot());

function find(predicate: (row: GanttRow) => boolean): GanttRow {
  const all: GanttRow[] = [];
  const walk = (row: GanttRow) => {
    all.push(row);
    for (const child of row.subRows) walk(child);
  };
  for (const row of rows) walk(row);
  const found = all.find(predicate);
  if (found === undefined) throw new Error('No such row');
  return found;
}

describe('#896 what Zoom to fit fits on the Gantt (ADR 0089, Zoom levels)', () => {
  it('fits every loaded row with nothing selected: G1 from Tue 3 Nov 11:30 to Tue 10 Nov 15:00', () => {
    expect(fitTargetOf(undefined, rows)).toEqual({
      span: { fromMs: Date.UTC(2026, 10, 3, 10, 30), toMs: Date.UTC(2026, 10, 10, 14) },
      name: 'every loaded row',
    });
  });

  it('fits an order from its first setup start to its last end', () => {
    const order = find((row) => row.kind === 'order' && row.order.number === '1003');

    expect(fitTargetOf(order, rows)).toEqual({
      span: { fromMs: Date.UTC(2026, 10, 4, 7), toMs: Date.UTC(2026, 10, 5, 5, 15) },
      name: 'order 1003',
    });
  });

  it('fits a job order over its own placement', () => {
    const jobOrder = find((row) => row.kind === 'jobOrder' && row.id === 'jo-1002-10');

    expect(fitTargetOf(jobOrder, rows)).toEqual({
      span: { fromMs: Date.UTC(2026, 10, 5, 10, 30), toMs: Date.UTC(2026, 10, 5, 14) },
      name: 'job order 1002.10',
    });
  });

  it('fits the run of a selected order that is in one, from its first setup start to its last end', () => {
    const run = {
      id: 'run-1001-1005',
      article: 'Bracket L',
      orderIds: ['po-1001', 'po-1005'],
      orderNumbers: ['1001', '1005'],
      deadlineMs: Date.UTC(2026, 10, 6, 14),
      savedSetups: [],
      early: [],
      before: [],
    };
    const withRun = buildGanttRows({ ...g1Snapshot(), runs: [run] });
    const byId = new Map<string, GanttRow>();
    const walk = (row: GanttRow) => {
      byId.set(row.id, row);
      for (const child of row.subRows) walk(child);
    };
    for (const row of withRun) walk(row);

    const selected = selectionRowOf(byId.get('po-1001'), byId);

    // 1001 from Tue 3 Nov 11:30 and 1005 to Tue 10 Nov 15:00.
    expect(fitTargetOf(selected, withRun)).toEqual({
      span: { fromMs: Date.UTC(2026, 10, 3, 10, 30), toMs: Date.UTC(2026, 10, 10, 14) },
      name: 'the run of Bracket L',
    });
    expect(selectionRowOf(byId.get('po-1003'), byId)?.id).toBe('po-1003');
  });
});
