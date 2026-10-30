// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The plan the board and the Gantt draw from what they loaded (ADR 0089, Loading by time chunk):
// the row list's orders, each job order with the placement its time chunk gave, and the analysis
// over the time buffer.
import { analyzeGantt } from './gantt-analysis.ts';
import type { GanttFrame, GanttJobOrder, GanttOrder, GanttSnapshot } from './gantt-data.ts';
import type { TimeRange } from './timeline/time-scale.ts';

/**
 * The snapshot of the loaded rows and chunks. A job order a loaded chunk holds takes the chunk's
 * version, placement included; one with a machine whose chunk is not loaded awaits its placement;
 * one without a machine sits in the Not placed row.
 */
export function loadedSnapshot(
  frame: GanttFrame,
  orders: readonly GanttOrder[],
  chunkJobOrders: readonly GanttJobOrder[],
  range: TimeRange,
): GanttSnapshot {
  const placed = new Map(chunkJobOrders.map((row) => [row.id, row]));
  const productionOrders = orders.map((order) => ({
    ...order,
    jobOrders: order.jobOrders.map((row): GanttJobOrder => {
      const loaded = placed.get(row.id);
      if (loaded !== undefined) return loaded;
      return row.equipment === undefined ? row : { ...row, awaitingPlacement: true };
    }),
  }));
  const base = { ...frame, productionOrders };
  return { ...base, analysis: analyzeGantt(base, range) };
}

/**
 * Whether a job order sits in the Not placed row: it has no placement and awaits none from a time
 * chunk (ADR 0089).
 */
export function isNotPlaced(jobOrder: GanttJobOrder): boolean {
  return jobOrder.placement === undefined && jobOrder.awaitingPlacement !== true;
}
