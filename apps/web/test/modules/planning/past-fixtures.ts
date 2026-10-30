// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// G1 variants for time before now (ADR 0089): G1's now is Mon 2 Nov 09:40 plant time (08:40Z).
import { g1 } from '@northmes/planning-domain';
import type { GanttSnapshot } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';

/**
 * G1 with 1001.10 planned on CNC 1 from Mon 2 Nov 07:00 plant time, or another setup start before
 * now, and not started: an overdue job order (glossary).
 */
export function g1WithOverdueRow(setupStartAt = '2026-11-02T06:00:00Z'): GanttSnapshot {
  const at = (offsetMs: number) => new Date(Date.parse(setupStartAt) + offsetMs).toISOString();
  return g1Snapshot({
    ...g1,
    productionOrders: g1.productionOrders.map((order) => ({
      ...order,
      jobOrders: order.jobOrders.map((row) =>
        row.id === 'jo-1001-10'
          ? {
              ...row,
              setupStartAt: at(0),
              runStartAt: at(30 * 60_000),
              endAt: at(5.5 * 3_600_000),
            }
          : row,
      ),
    })),
  });
}

/** G1 as the plan reads at a later now, with the frozen window as long as G1's (24 h). */
export function g1At(nowInstant: string): GanttSnapshot {
  const fence = new Date(Date.parse(nowInstant) + 24 * 3_600_000).toISOString();
  return g1Snapshot({
    ...g1,
    now: { ...g1.now, instant: nowInstant },
    fence: { ...g1.fence, instant: fence },
  });
}
