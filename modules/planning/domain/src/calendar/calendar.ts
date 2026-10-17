// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// A working-time calendar as the domain reads it (ADR 0025): a weekly pattern of shifts with their
// breaks on the plant's wall clock, and deviations that open or close time plant-wide or on named
// machines. availabilityOf expands it to the half-open millisecond windows of one machine over a
// range, with Temporal at the edges only.
import { Temporal } from 'temporal-polyfill';
import { clipWindows, subtractWindows, unionWindows, type Window } from './windows.ts';

/** A span on the wall clock, "06:00" to "15:00"; an end at or before the start is on the next date. */
export interface ClockSpan {
  readonly start: string;
  readonly end: string;
}

/** One shift of the weekly pattern on an ISO weekday (1 Monday to 7 Sunday), with its breaks. */
export interface Shift extends ClockSpan {
  readonly isoWeekday: number;
  readonly breaks: readonly ClockSpan[];
}

/**
 * A deviation from the pattern (ADR 0025): overtime opens time, non-working closes it, between two
 * wall-clock instants of the plant. Without `equipment` it applies to the whole plant.
 */
export interface CalendarDeviation {
  readonly kind: 'overtime' | 'nonWorking';
  /** A plant-local date and time, "2026-11-09T00:00". */
  readonly startsLocal: string;
  readonly endsLocal: string;
  readonly reason?: string;
  /** The machines it applies to, by code; none, or an empty list, means the whole plant. */
  readonly equipment?: readonly string[];
}

export interface WorkingCalendar {
  /** The plant's IANA zone. */
  readonly timeZone: string;
  readonly shifts: readonly Shift[];
  readonly deviations: readonly CalendarDeviation[];
}

/** The shape a one-shift weekly calendar is written in, such as the A1 calendar of the fixtures. */
export interface WeeklyCalendarInput {
  readonly timeZone: string;
  /** The ISO weekdays with the shift. */
  readonly weekdays: readonly number[];
  readonly shift: ClockSpan;
  readonly breaks: readonly ClockSpan[];
  readonly deviations?: readonly CalendarDeviation[];
}

/** A calendar with one shift on each of its weekdays. */
export function weeklyCalendar(input: WeeklyCalendarInput): WorkingCalendar {
  return {
    timeZone: input.timeZone,
    shifts: input.weekdays.map((isoWeekday) => ({
      isoWeekday,
      start: input.shift.start,
      end: input.shift.end,
      breaks: input.breaks,
    })),
    deviations: input.deviations ?? [],
  };
}

/**
 * A wall-clock time of the plant as an instant, with the clamp rule of ADR 0024: a time in the
 * spring gap is the first instant after the gap, a repeated autumn time is its first occurrence.
 * The rule is monotonic, so adjacent windows stay adjacent.
 */
export function resolveWallClock(
  timeZone: string,
  date: Temporal.PlainDate,
  time: Temporal.PlainTime,
): number {
  const local = date.toPlainDateTime(time);
  const first = local.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
  if (first.toPlainDateTime().equals(local)) return first.epochMilliseconds;
  const transition = first.getTimeZoneTransition('next');
  return transition === null ? first.epochMilliseconds : transition.epochMilliseconds;
}

/** A plant-local "2026-11-09T00:00" as an instant through the clamp rule. */
export function resolveLocalDateTime(timeZone: string, local: string): number {
  const plain = Temporal.PlainDateTime.from(local);
  return resolveWallClock(timeZone, plain.toPlainDate(), plain.toPlainTime());
}

function clockOf(clock: string): Temporal.PlainTime {
  return Temporal.PlainTime.from(clock);
}

/**
 * A clock span of a shift as a window on a date: the end lies on the next date when it is at or
 * before the start, as a night shift's does.
 */
function spanOn(timeZone: string, date: Temporal.PlainDate, span: ClockSpan): Window {
  const start = clockOf(span.start);
  const end = clockOf(span.end);
  const endDate = Temporal.PlainTime.compare(end, start) <= 0 ? date.add({ days: 1 }) : date;
  return {
    fromMs: resolveWallClock(timeZone, date, start),
    toMs: resolveWallClock(timeZone, endDate, end),
  };
}

/** A break of a shift as a window: a break that starts before the shift lies on the next date. */
function breakOn(
  timeZone: string,
  date: Temporal.PlainDate,
  shift: Shift,
  pause: ClockSpan,
): Window {
  const shiftStart = clockOf(shift.start);
  const start = clockOf(pause.start);
  const end = clockOf(pause.end);
  const startDate =
    Temporal.PlainTime.compare(start, shiftStart) < 0 ? date.add({ days: 1 }) : date;
  const endDate =
    Temporal.PlainTime.compare(end, start) <= 0 ? startDate.add({ days: 1 }) : startDate;
  return {
    fromMs: resolveWallClock(timeZone, startDate, start),
    toMs: resolveWallClock(timeZone, endDate, end),
  };
}

function deviationWindow(timeZone: string, deviation: CalendarDeviation): Window {
  return {
    fromMs: resolveLocalDateTime(timeZone, deviation.startsLocal),
    toMs: resolveLocalDateTime(timeZone, deviation.endsLocal),
  };
}

/**
 * The availability of one machine, or of the plant when no machine is named, inside [fromMs, toMs)
 * as sorted, disjoint windows (ADR 0025 rules 7 to 9): the shifts less their breaks on every date
 * from the local date of `from` less one day to the local date of `to`, plus plant-wide overtime,
 * less plant-wide non-working time, plus the machine's overtime, less its non-working time, then
 * clipped to the range. An equipment deviation therefore overrides a plant-wide one, and within one
 * scope non-working wins over overtime.
 */
export function availabilityOf(
  calendar: WorkingCalendar,
  equipment: string | undefined,
  fromMs: number,
  toMs: number,
): Window[] {
  if (toMs <= fromMs) return [];
  const { timeZone } = calendar;
  const firstDate = Temporal.Instant.fromEpochMilliseconds(fromMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .subtract({ days: 1 });
  const lastDate = Temporal.Instant.fromEpochMilliseconds(toMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
  const open: Window[] = [];
  const closed: Window[] = [];
  for (
    let date = firstDate;
    Temporal.PlainDate.compare(date, lastDate) <= 0;
    date = date.add({ days: 1 })
  ) {
    for (const shift of calendar.shifts) {
      if (shift.isoWeekday !== date.dayOfWeek) continue;
      open.push(spanOn(timeZone, date, shift));
      for (const pause of shift.breaks) closed.push(breakOn(timeZone, date, shift, pause));
    }
  }
  let windows = subtractWindows(open, closed);
  const scoped = (scope: 'plant' | 'equipment', kind: CalendarDeviation['kind']): Window[] =>
    calendar.deviations
      .filter(
        (deviation) =>
          deviation.kind === kind &&
          (scope === 'plant'
            ? deviation.equipment === undefined || deviation.equipment.length === 0
            : equipment !== undefined && deviation.equipment?.includes(equipment) === true),
      )
      .map((deviation) => deviationWindow(timeZone, deviation));
  windows = unionWindows(windows, scoped('plant', 'overtime'));
  windows = subtractWindows(windows, scoped('plant', 'nonWorking'));
  windows = unionWindows(windows, scoped('equipment', 'overtime'));
  windows = subtractWindows(windows, scoped('equipment', 'nonWorking'));
  return clipWindows(windows, fromMs, toMs);
}
