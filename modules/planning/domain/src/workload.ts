// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Workload per machine and bucket (plan 18, Workload): available working seconds from the
// calendar, the seconds loaded by job orders with their setup and run split, the free time, the
// utilization and the overload. The browser computes it over the loaded range, the draft included;
// the server computes the plant-wide table with the same function.
import { Temporal } from 'temporal-polyfill';
import type { WorkingCalendar } from './calendar/calendar.ts';
import { addWork, type Windows, workBetween } from './calendar/windows.ts';
import {
  availabilityOn,
  compareCodeUnits,
  type PlanContext,
  type PlanJobOrder,
} from './plan-context.ts';

/** One cell of the workload lane: a production day, a shift, an ISO week or a month, [fromMs, toMs). */
export interface Bucket {
  /** The bucket's name: a plant date, "2026-11-02 06:00 to 15:00", "2026-W45" or "2026-11". */
  readonly label: string;
  readonly fromMs: number;
  readonly toMs: number;
}

export interface WorkloadItem {
  /** The job order's display number. */
  readonly jobOrder: string;
  readonly seconds: number;
}

export interface WorkloadBucket extends Bucket {
  readonly equipment: string;
  readonly availableS: number;
  /** The working seconds the job orders on the machine lay in the bucket, overlapping rows counted twice. */
  readonly loadedS: number;
  readonly setupS: number;
  readonly runS: number;
  /** The working time still open in the bucket. */
  readonly freeS: number;
  /** Loaded over available as a permille integer; null when the bucket is closed. */
  readonly utilizationPermille: number | null;
  /** Load above availability, plus work laid in closed time. */
  readonly overloadS: number;
  readonly items: readonly WorkloadItem[];
}

function clockOf(clock: string): Temporal.PlainTime {
  return Temporal.PlainTime.from(clock);
}

function localDateOf(epochMs: number, timeZone: string): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(timeZone).toPlainDate();
}

function atLocal(timeZone: string, date: Temporal.PlainDate, time: Temporal.PlainTime): number {
  return date.toZonedDateTime({ timeZone, plainTime: time }).epochMilliseconds;
}

/** Buckets clipped to a range, empty ones dropped. */
function clipped(buckets: readonly Bucket[], fromMs: number, toMs: number): Bucket[] {
  return buckets
    .map((bucket) => ({
      ...bucket,
      fromMs: Math.max(bucket.fromMs, fromMs),
      toMs: Math.min(bucket.toMs, toMs),
    }))
    .filter((bucket) => bucket.toMs > bucket.fromMs);
}

/**
 * One bucket per production day overlapping a range (ADR 0025): the day starts at the plant's
 * production day start on the wall clock, and is labelled with its date.
 */
export function productionDayBuckets(input: {
  readonly timeZone: string;
  readonly productionDayStart: string;
  readonly fromMs: number;
  readonly toMs: number;
}): Bucket[] {
  const { timeZone, fromMs, toMs } = input;
  const start = clockOf(input.productionDayStart);
  const buckets: Bucket[] = [];
  let date = localDateOf(fromMs, timeZone).subtract({ days: 1 });
  for (;;) {
    const dayFromMs = atLocal(timeZone, date, start);
    if (dayFromMs >= toMs) break;
    const dayToMs = atLocal(timeZone, date.add({ days: 1 }), start);
    if (dayToMs > fromMs)
      buckets.push({ label: date.toString(), fromMs: dayFromMs, toMs: dayToMs });
    date = date.add({ days: 1 });
  }
  return clipped(buckets, fromMs, toMs);
}

/** One bucket per ISO week overlapping a range, from Monday 00:00 on the wall clock, labelled "2026-W45". */
export function isoWeekBuckets(input: {
  readonly timeZone: string;
  readonly fromMs: number;
  readonly toMs: number;
}): Bucket[] {
  const { timeZone, fromMs, toMs } = input;
  const midnight = Temporal.PlainTime.from('00:00');
  const buckets: Bucket[] = [];
  let monday = localDateOf(fromMs, timeZone);
  monday = monday.subtract({ days: monday.dayOfWeek - 1 });
  for (;;) {
    const weekFromMs = atLocal(timeZone, monday, midnight);
    if (weekFromMs >= toMs) break;
    const next = monday.add({ weeks: 1 });
    const weekToMs = atLocal(timeZone, next, midnight);
    if (weekToMs > fromMs) {
      const week = String(monday.weekOfYear ?? 0).padStart(2, '0');
      buckets.push({
        label: `${monday.yearOfWeek ?? monday.year}-W${week}`,
        fromMs: weekFromMs,
        toMs: weekToMs,
      });
    }
    monday = next;
  }
  return clipped(buckets, fromMs, toMs);
}

/** One bucket per calendar month overlapping a range, from the first at 00:00 on the wall clock, labelled "2026-11". */
export function monthBuckets(input: {
  readonly timeZone: string;
  readonly fromMs: number;
  readonly toMs: number;
}): Bucket[] {
  const { timeZone, fromMs, toMs } = input;
  const midnight = Temporal.PlainTime.from('00:00');
  const buckets: Bucket[] = [];
  let first = localDateOf(fromMs, timeZone).with({ day: 1 });
  for (;;) {
    const monthFromMs = atLocal(timeZone, first, midnight);
    if (monthFromMs >= toMs) break;
    const next = first.add({ months: 1 });
    const monthToMs = atLocal(timeZone, next, midnight);
    if (monthToMs > fromMs) {
      buckets.push({
        label: first.toPlainYearMonth().toString(),
        fromMs: monthFromMs,
        toMs: monthToMs,
      });
    }
    first = next;
  }
  return clipped(buckets, fromMs, toMs);
}

/**
 * One bucket per shift of the plant calendar overlapping a range, plus one per plant-wide overtime
 * deviation, each labelled with its date and clock span, so Hours and Day zoom read the load per shift.
 */
export function shiftBuckets(calendar: WorkingCalendar, fromMs: number, toMs: number): Bucket[] {
  const { timeZone } = calendar;
  const buckets: Bucket[] = [];
  const last = localDateOf(toMs, timeZone);
  for (
    let date = localDateOf(fromMs, timeZone).subtract({ days: 1 });
    Temporal.PlainDate.compare(date, last) <= 0;
    date = date.add({ days: 1 })
  ) {
    for (const shift of calendar.shifts) {
      if (shift.isoWeekday !== date.dayOfWeek) continue;
      const start = clockOf(shift.start);
      const end = clockOf(shift.end);
      const endDate = Temporal.PlainTime.compare(end, start) <= 0 ? date.add({ days: 1 }) : date;
      buckets.push({
        label: `${date.toString()} ${shift.start} to ${shift.end}`,
        fromMs: atLocal(timeZone, date, start),
        toMs: atLocal(timeZone, endDate, end),
      });
    }
  }
  for (const deviation of calendar.deviations) {
    if (deviation.kind !== 'overtime' || deviation.equipment !== undefined) continue;
    const from = Temporal.PlainDateTime.from(deviation.startsLocal);
    const to = Temporal.PlainDateTime.from(deviation.endsLocal);
    buckets.push({
      label: `${from.toPlainDate().toString()} ${from.toPlainTime().toString({ smallestUnit: 'minute' })} to ${to.toPlainTime().toString({ smallestUnit: 'minute' })} overtime`,
      fromMs: from.toZonedDateTime(timeZone).epochMilliseconds,
      toMs: to.toZonedDateTime(timeZone).epochMilliseconds,
    });
  }
  buckets.sort((a, b) => a.fromMs - b.fromMs || compareCodeUnits(a.label, b.label));
  return clipped(buckets, fromMs, toMs);
}

/**
 * The working segments of a placed row on its machine: its setup, then its run, as committed,
 * each capped at its planned seconds, so open time a calendar change added inside the span never
 * inflates the load. `closedS` is the planned work the span no longer holds, anchored where the
 * last laid segment ends, or at the setup start of a row with no open time at all.
 */
function partsOf(
  row: PlanJobOrder,
  windows: Windows,
): { setup: Windows; run: Windows; closedS: number; anchorMs: number; laid: boolean } | undefined {
  const span = row.placement;
  if (span === undefined) return undefined;
  const planned = row.plannedSetupS + row.plannedRunS;
  const laidWorkingS = workBetween(windows, span.setupStartMs, span.endMs);
  const setup = addWork(windows, span.setupStartMs, Math.min(row.plannedSetupS, laidWorkingS));
  const run = addWork(
    windows,
    setup?.endMs ?? span.setupStartMs,
    Math.min(row.plannedRunS, Math.max(0, laidWorkingS - row.plannedSetupS)),
  );
  const segments = [...(setup?.segments ?? []), ...(run?.segments ?? [])];
  const last = segments[segments.length - 1];
  return {
    setup: setup?.segments ?? [],
    run: run?.segments ?? [],
    closedS: Math.max(0, planned - laidWorkingS),
    anchorMs: last?.toMs ?? span.setupStartMs,
    laid: last !== undefined,
  };
}

/**
 * Whether a row's closed time belongs to a bucket: the end of its last laid segment lies in the
 * bucket, an end on the bucket's own end included; a row with no open time counts by its start.
 */
function closedTimeIn(parts: { anchorMs: number; laid: boolean }, bucket: Bucket): boolean {
  return parts.laid
    ? parts.anchorMs > bucket.fromMs && parts.anchorMs <= bucket.toMs
    : parts.anchorMs >= bucket.fromMs && parts.anchorMs < bucket.toMs;
}

/**
 * The workload of every machine of the context in every bucket (plan 18, Definition): available
 * working seconds, the seconds loaded by the job orders on the machine as the context places them
 * (a draft counts at its draft position), their setup and run split, the free time, the utilization
 * as a permille integer (null when closed) and the overload, with one item per job order that
 * loads the bucket. Machines by code, buckets in their order.
 */
export function workload(context: PlanContext, buckets: readonly Bucket[]): WorkloadBucket[] {
  const machines = Object.keys(context.availability).sort(compareCodeUnits);
  const result: WorkloadBucket[] = [];
  const rowsOn = new Map<string, PlanJobOrder[]>();
  for (const order of context.orders) {
    for (const row of order.jobOrders) {
      if (row.equipment === undefined || row.placement === undefined) continue;
      rowsOn.set(row.equipment, [...(rowsOn.get(row.equipment) ?? []), row]);
    }
  }
  for (const bucket of buckets) {
    for (const equipment of machines) {
      const windows = availabilityOn(context, equipment);
      const availableS = workBetween(windows, bucket.fromMs, bucket.toMs);
      let setupS = 0;
      let runS = 0;
      let closedS = 0;
      const items: WorkloadItem[] = [];
      const rows = (rowsOn.get(equipment) ?? []).sort(
        (a, b) =>
          compareCodeUnits(a.displayNumber, b.displayNumber) || compareCodeUnits(a.id, b.id),
      );
      for (const row of rows) {
        const parts = partsOf(row, windows);
        if (parts === undefined) continue;
        const rowSetup = workBetween(parts.setup, bucket.fromMs, bucket.toMs);
        const rowRun = workBetween(parts.run, bucket.fromMs, bucket.toMs);
        if (parts.closedS > 0 && closedTimeIn(parts, bucket)) closedS += parts.closedS;
        setupS += rowSetup;
        runS += rowRun;
        if (rowSetup + rowRun > 0)
          items.push({ jobOrder: row.displayNumber, seconds: rowSetup + rowRun });
      }
      const loadedS = setupS + runS;
      result.push({
        ...bucket,
        equipment,
        availableS,
        loadedS,
        setupS,
        runS,
        freeS: Math.max(0, availableS - loadedS),
        utilizationPermille: availableS === 0 ? null : Math.round((loadedS * 1000) / availableS),
        overloadS: Math.max(0, loadedS - availableS) + closedS,
        items,
      });
    }
  }
  return result;
}
