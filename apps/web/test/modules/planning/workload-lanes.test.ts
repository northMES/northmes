// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { previewOf } from '../../../src/modules/planning/screens/gantt/gantt-move.ts';
import {
  bucketKindOf,
  withMovePreview,
  workloadOf,
} from '../../../src/modules/planning/workload-lanes.ts';

// Week 45 in Europe/Stockholm: Mon 2 Nov 00:00 to Mon 9 Nov 00:00.
const week = { fromMs: Date.UTC(2026, 10, 1, 23), toMs: Date.UTC(2026, 10, 8, 23) };

function bucketOf(
  buckets: ReturnType<typeof workloadOf>,
  equipment: string,
  label: string,
): (typeof buckets)[number] | undefined {
  return buckets.find((bucket) => bucket.equipment === equipment && bucket.label === label);
}

describe('the buckets of the workload lanes follow the zoom level (ADR 0089; #901)', () => {
  it('Hours and Day bucket by shift, Week by production day, 4 weeks by ISO week', () => {
    expect(bucketKindOf('hours')).toBe('shift');
    expect(bucketKindOf('day')).toBe('shift');
    expect(bucketKindOf('week')).toBe('productionDay');
    expect(bucketKindOf('4weeks')).toBe('isoWeek');
  });

  it('by shift, CNC1 holds the GT5 load of Thu 5 Nov in its shift from 06:00 to 15:00', () => {
    const buckets = workloadOf(g1Snapshot(), 'day', week);

    const thursday = bucketOf(buckets, 'CNC1', '2026-11-05 06:00 to 15:00');
    expect(thursday?.loadedS).toBe(29_700);
    expect(thursday?.availableS).toBe(29_700);
  });

  it('by ISO week, CNC1 holds the load of every GT5 production day in 2026-W45', () => {
    const buckets = workloadOf(g1Snapshot(), '4weeks', week);

    // 12 600 + 21 600 + 29 700 + 8 100 seconds from Tue to Fri.
    expect(bucketOf(buckets, 'CNC1', '2026-W45')?.loadedS).toBe(72_000);
  });

  it('by production day, it is the analysis of the snapshot', () => {
    const snapshot = g1Snapshot();

    expect(workloadOf(snapshot, 'week', week)).toBe(snapshot.analysis.workload);
  });
});

describe('the workload follows a move preview (plan 18, The workload lane; #901)', () => {
  // 1003.10, 4 h on CNC1 from Wed 08:00, dragged to Thu 06:00, where CNC1 is full: the cascade
  // carries 1003.20 on Mill 1 with it.
  const snapshot = g1Snapshot();
  const preview = previewOf(
    snapshot,
    {
      jobOrderId: 'jo-1003-10',
      setupStartMs: Date.UTC(2026, 10, 5, 5),
      equipment: 'CNC1',
      source: 'pointer',
    },
    true,
  );
  if (preview === undefined) throw new Error('No preview of 1003.10');
  const before = workloadOf(snapshot, 'week', week);

  it('moves the load of the dragged row from its day to the day it is dragged to', () => {
    const after = withMovePreview(snapshot, before, preview);

    expect(bucketOf(after, 'CNC1', '2026-11-04')?.loadedS).toBe(21_600 - 14_400);
    expect(bucketOf(after, 'CNC1', '2026-11-05')?.loadedS).toBe(29_700 + 14_400);
    expect(bucketOf(after, 'CNC1', '2026-11-05')?.overloadS).toBe(14_400);
  });

  it('recomputes the machines the move and its cascade touch, and keeps the others as they are', () => {
    const after = withMovePreview(snapshot, before, preview);

    expect(bucketOf(after, 'MILL1', '2026-11-05')).not.toBe(
      bucketOf(before, 'MILL1', '2026-11-05'),
    );
    expect(bucketOf(after, 'CNC2', '2026-11-05')).toBe(bucketOf(before, 'CNC2', '2026-11-05'));
    expect(after.map((bucket) => `${bucket.equipment} ${bucket.label}`)).toEqual(
      before.map((bucket) => `${bucket.equipment} ${bucket.label}`),
    );
  });
});
