// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The buckets of the workload lanes (plan 18, The workload lane): the bucket kind the zoom level
// sets, the workload of the plan with the draft in those buckets, and the workload while a move
// is previewed, recomputed for the machines the move and its cascade touch.
import {
  type Bucket,
  isoWeekBuckets,
  shiftBuckets,
  type WorkloadBucket,
  workload,
} from '@northmes/planning-domain';
import { workingCalendarOf } from './gantt-analysis.ts';
import type { GanttSnapshot, ZoomPreset } from './gantt-data.ts';
import { type MovePreview, moveContextOf } from './screens/gantt/gantt-move.ts';
import type { TimeRange } from './timeline/time-scale.ts';

export type BucketKind = 'shift' | 'productionDay' | 'isoWeek';

/**
 * The bucket of a zoom level (ADR 0089, the ladder): Hours and Day by shift, Week by production
 * day, 4 weeks by ISO week.
 */
export function bucketKindOf(zoom: ZoomPreset): BucketKind {
  if (zoom === 'week') return 'productionDay';
  if (zoom === '4weeks') return 'isoWeek';
  return 'shift';
}

/**
 * The workload of the plan with the draft applied, per machine and bucket of the zoom level. By
 * production day it is the snapshot's analysis; by shift and by ISO week the same domain function
 * runs over the buckets of the range.
 */
export function workloadOf(
  snapshot: GanttSnapshot,
  zoom: ZoomPreset,
  range: TimeRange,
): readonly WorkloadBucket[] {
  const kind = bucketKindOf(zoom);
  if (kind === 'productionDay') return snapshot.analysis.workload;
  const { timeZone } = snapshot.plant;
  const buckets =
    kind === 'shift'
      ? shiftBuckets(workingCalendarOf(snapshot.calendar, timeZone), range.fromMs, range.toMs)
      : isoWeekBuckets({ timeZone, fromMs: range.fromMs, toMs: range.toMs });
  return workload(moveContextOf(snapshot), buckets);
}

/**
 * The workload while a move is previewed (plan 18: the lane follows the draft in the drag
 * preview's frame): the machines the moved row leaves and enters and the machines of the rows the
 * cascade carries are computed again with the preview's spans; every other bucket stays the same
 * object.
 */
export function withMovePreview(
  snapshot: GanttSnapshot,
  buckets: readonly WorkloadBucket[],
  preview: MovePreview,
): readonly WorkloadBucket[] {
  const context = moveContextOf(snapshot);
  const spans = new Map([[preview.jobOrderId, preview.span], ...preview.ghosts]);
  const touched = new Set<string>([preview.equipment]);
  const orders = context.orders.map((order) => {
    if (!order.jobOrders.some((row) => spans.has(row.id))) return order;
    return {
      ...order,
      jobOrders: order.jobOrders.map((row) => {
        const span = spans.get(row.id);
        if (span === undefined) return row;
        if (row.equipment !== undefined) touched.add(row.equipment);
        const equipment = row.id === preview.jobOrderId ? preview.equipment : row.equipment;
        return { ...row, ...(equipment !== undefined && { equipment }), placement: span };
      }),
    };
  });
  // Every machine shares the buckets of the range, so the spans of the first one serve.
  const spansOfBuckets = new Map<string, Bucket>();
  for (const bucket of buckets) {
    if (!spansOfBuckets.has(bucket.label)) {
      spansOfBuckets.set(bucket.label, {
        label: bucket.label,
        fromMs: bucket.fromMs,
        toMs: bucket.toMs,
      });
    }
  }
  const availability = Object.fromEntries(
    [...touched].flatMap((code) => {
      const windows = context.availability[code];
      return windows === undefined ? [] : [[code, windows]];
    }),
  );
  const again = new Map(
    workload({ ...context, orders, availability }, [...spansOfBuckets.values()]).map((bucket) => [
      `${bucket.equipment} ${bucket.label}`,
      bucket,
    ]),
  );
  return buckets.map((bucket) => again.get(`${bucket.equipment} ${bucket.label}`) ?? bucket);
}
