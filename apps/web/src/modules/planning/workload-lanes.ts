// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The buckets of the workload lanes (plan 18, The workload lane): the bucket kind the zoom level
// sets, the workload of the plan with the draft in those buckets, and the workload while a move
// is previewed, recomputed for the machines the move and its cascade touch.
import {
  type Bucket,
  isoWeekBuckets,
  monthBuckets,
  type PlanContext,
  shiftBuckets,
  type WorkloadBucket,
  workload,
} from '@northmes/planning-domain';
import { planContextOf, workingCalendarOf } from './gantt-analysis.ts';
import type { GanttSnapshot, ZoomLevel } from './gantt-data.ts';
import type { MovePreview } from './screens/gantt/gantt-move.ts';
import { type BucketKind, type TimeRange, zoomLevels } from './timeline/time-scale.ts';

const day = 86_400_000;

const laneContexts = new WeakMap<GanttSnapshot, Map<string, PlanContext>>();

/**
 * The plan context the lanes read, built once per plan with the draft and range: its availability
 * covers the range, which the context of a move, laid from now to the fence, need not.
 */
function laneContextOf(snapshot: GanttSnapshot, range: TimeRange): PlanContext {
  let byRange = laneContexts.get(snapshot);
  if (byRange === undefined) {
    byRange = new Map();
    laneContexts.set(snapshot, byRange);
  }
  const key = `${range.fromMs} ${range.toMs}`;
  let context = byRange.get(key);
  if (context === undefined) {
    context = planContextOf(snapshot, range);
    byRange.set(key, context);
  }
  return context;
}

/**
 * The buckets of a kind that overlap a range, each over its whole span: a shift, a week or a month
 * the range edge cuts keeps its values, and the lane draws only the part in the range.
 */
function bucketsOf(
  kind: 'shift' | 'isoWeek' | 'month',
  snapshot: GanttSnapshot,
  range: TimeRange,
): Bucket[] {
  const { timeZone } = snapshot.plant;
  // A day on each side holds every shift that overlaps the range whole; a week, every week; 31
  // days, every month.
  const margin = kind === 'shift' ? day : kind === 'isoWeek' ? 7 * day : 31 * day;
  const fromMs = range.fromMs - margin;
  const toMs = range.toMs + margin;
  const all =
    kind === 'shift'
      ? shiftBuckets(workingCalendarOf(snapshot.calendar, timeZone), fromMs, toMs)
      : kind === 'isoWeek'
        ? isoWeekBuckets({ timeZone, fromMs, toMs })
        : monthBuckets({ timeZone, fromMs, toMs });
  return all.filter((bucket) => bucket.toMs > range.fromMs && bucket.fromMs < range.toMs);
}

export type { BucketKind };

/**
 * The bucket of a zoom level (ADR 0089, the ladder): Quarter hours, Hours and Day by shift, Week
 * by production day, 4 weeks and Quarter by ISO week, Year by month.
 */
export function bucketKindOf(zoom: ZoomLevel): BucketKind {
  return zoomLevels[zoom].bucket;
}

/**
 * The workload of the plan with the draft applied, per machine and bucket of the zoom level. By
 * production day it is the snapshot's analysis; by shift, ISO week and month the same domain function
 * runs over the buckets of the range.
 */
export function workloadOf(
  snapshot: GanttSnapshot,
  zoom: ZoomLevel,
  range: TimeRange,
): readonly WorkloadBucket[] {
  const kind = bucketKindOf(zoom);
  if (kind === 'productionDay') return snapshot.analysis.workload;
  return workload(laneContextOf(snapshot, range), bucketsOf(kind, snapshot, range));
}

/**
 * The workload while a move is previewed (plan 18: the lane follows the draft in the drag
 * preview's frame): on the machines the moved row leaves and enters and the machines of the rows
 * the cascade carries, the buckets the old and the new spans overlap are computed again with the
 * preview's spans; every other bucket stays the same object. A preview of a move that does not
 * happen, refused or past the horizon, leaves the workload as it is.
 */
export function withMovePreview(
  snapshot: GanttSnapshot,
  buckets: readonly WorkloadBucket[],
  preview: MovePreview,
  range: TimeRange,
): readonly WorkloadBucket[] {
  if (preview.reason === undefined) return buckets;
  const context = laneContextOf(snapshot, range);
  const spans = new Map([[preview.jobOrderId, preview.span], ...preview.ghosts]);
  const touched = new Set<string>([preview.equipment]);
  // The time the old and the new spans cover, where the load changes.
  let changedFromMs = Number.POSITIVE_INFINITY;
  let changedToMs = Number.NEGATIVE_INFINITY;
  const cover = (span: { readonly setupStartMs: number; readonly endMs: number }) => {
    changedFromMs = Math.min(changedFromMs, span.setupStartMs);
    changedToMs = Math.max(changedToMs, span.endMs);
  };
  const orders = context.orders.map((order) => {
    if (!order.jobOrders.some((row) => spans.has(row.id))) return order;
    return {
      ...order,
      jobOrders: order.jobOrders.map((row) => {
        const span = spans.get(row.id);
        if (span === undefined) return row;
        if (row.equipment !== undefined) touched.add(row.equipment);
        if (row.placement !== undefined) cover(row.placement);
        cover(span);
        const equipment = row.id === preview.jobOrderId ? preview.equipment : row.equipment;
        return { ...row, ...(equipment !== undefined && { equipment }), placement: span };
      }),
    };
  });
  // Every machine shares the buckets of the range, so the spans of the first one serve.
  const spansOfBuckets = new Map<string, Bucket>();
  for (const bucket of buckets) {
    const changed = bucket.toMs > changedFromMs && bucket.fromMs < changedToMs;
    if (changed && !spansOfBuckets.has(bucket.label)) {
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
