// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Temporal } from 'temporal-polyfill';
import type { GanttCalendar } from '../gantt-data.ts';
import type { ClosedWindow, TimeRange } from './time-scale.ts';

/** A window of open time of a calendar, [fromMs, toMs). */
export interface OpenWindow {
  readonly fromMs: number;
  readonly toMs: number;
}

function clockOf(clock: string): Temporal.PlainTime {
  const [hour = 0, minute = 0] = clock.split(':').map(Number);
  return Temporal.PlainTime.from({ hour, minute });
}

/**
 * The open windows of a calendar inside a range (plan 18, Shading and the shift strip): on each
 * working day the shift less its breaks, each window on the plant's wall clock, so a clock change
 * keeps the shift's clock times (ADR 0024). The timeline reads availability from core in release 1;
 * phase 1 derives it from the plant calendar of the snapshot, which has no deviations.
 */
export function openWindows(
  calendar: GanttCalendar,
  timeZone: string,
  range: TimeRange,
): OpenWindow[] {
  const windows: OpenWindow[] = [];
  const first = Temporal.Instant.fromEpochMilliseconds(range.fromMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
  const shiftStart = clockOf(calendar.shift.start);
  const shiftEnd = clockOf(calendar.shift.end);
  const breaks = calendar.breaks.map((pause) => ({
    start: clockOf(pause.start),
    end: clockOf(pause.end),
  }));
  for (let date = first; ; date = date.add({ days: 1 })) {
    const dayStart = date.toZonedDateTime({ timeZone }).epochMilliseconds;
    if (dayStart >= range.toMs) break;
    if (!calendar.weekdays.includes(date.dayOfWeek)) continue;
    const at = (clock: Temporal.PlainTime) =>
      date.toZonedDateTime({ timeZone, plainTime: clock }).epochMilliseconds;
    let cursor = at(shiftStart);
    for (const pause of breaks) {
      const pauseStart = at(pause.start);
      if (pauseStart > cursor) windows.push({ fromMs: cursor, toMs: pauseStart });
      cursor = Math.max(cursor, at(pause.end));
    }
    const end = at(shiftEnd);
    if (end > cursor) windows.push({ fromMs: cursor, toMs: end });
  }
  return windows
    .map((window) => ({
      fromMs: Math.max(window.fromMs, range.fromMs),
      toMs: Math.min(window.toMs, range.toMs),
    }))
    .filter((window) => window.toMs > window.fromMs);
}

/**
 * The closed windows of a calendar inside a range: the complement of its open windows, with a
 * night and the next morning as one window and a weekend as one. The rows shade them in the
 * off-time token and the compressed axis draws each as a gap.
 */
export function closedWindows(
  calendar: GanttCalendar,
  timeZone: string,
  range: TimeRange,
): ClosedWindow[] {
  const closed: ClosedWindow[] = [];
  let cursor = range.fromMs;
  for (const window of openWindows(calendar, timeZone, range)) {
    if (window.fromMs > cursor) closed.push({ fromMs: cursor, toMs: window.fromMs });
    cursor = window.toMs;
  }
  if (range.toMs > cursor) closed.push({ fromMs: cursor, toMs: range.toMs });
  return closed;
}

/** The working milliseconds of a calendar between two instants. */
export function workingMsBetween(
  calendar: GanttCalendar,
  timeZone: string,
  fromMs: number,
  toMs: number,
): number {
  if (toMs <= fromMs) return 0;
  return openWindows(calendar, timeZone, { fromMs, toMs }).reduce(
    (sum, window) => sum + (window.toMs - window.fromMs),
    0,
  );
}
