// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Temporal } from 'temporal-polyfill';

/**
 * The first plant dates on which a production day start falls in a clock change of its zone: the
 * date it repeats in the autumn hour and the date it is skipped in the spring gap. Only the
 * changes that hit the time are named.
 */
export interface ProductionDayStartClash {
  readonly repeated?: string;
  readonly skipped?: string;
}

/** How many years of the zone's clock changes a day start is checked against (ADR 0025). */
const yearsChecked = 10;

/**
 * Checks a production day start, a plant-local "HH:MM", against the clock changes of its zone for
 * the next 10 years from a plant date (ADR 0025): a start that the zone skips or repeats on some
 * day is refused, because that day would have no start or two. Answers undefined when the time is
 * safe. The rule is core's and moves to core's plant contract with #419 (E06-S05).
 */
export function productionDayStartClash(
  timeZone: string,
  time: string,
  fromDate: string,
): ProductionDayStartClash | undefined {
  const start = Temporal.PlainTime.from(time);
  const from = Temporal.PlainDate.from(fromDate).toZonedDateTime({ timeZone });
  const until = from.add({ years: yearsChecked });
  let repeated: string | undefined;
  let skipped: string | undefined;
  let cursor = from;
  for (;;) {
    const transition = cursor.getTimeZoneTransition('next');
    if (transition === null || Temporal.ZonedDateTime.compare(transition, until) >= 0) break;
    // The wall-clock date on either side of the change: a change at midnight moves the date.
    const dates = new Set([
      transition.subtract({ nanoseconds: 1 }).toPlainDate().toString(),
      transition.toPlainDate().toString(),
    ]);
    for (const date of dates) {
      const local = Temporal.PlainDate.from(date).toPlainDateTime(start);
      const earlier = local.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
      const later = local.toZonedDateTime(timeZone, { disambiguation: 'later' });
      if (earlier.epochNanoseconds === later.epochNanoseconds) continue;
      const exists = earlier.toPlainDateTime().equals(local) && later.toPlainDateTime().equals(local);
      if (exists) repeated ??= date;
      else skipped ??= date;
    }
    if (repeated !== undefined && skipped !== undefined) break;
    cursor = transition;
  }
  if (repeated === undefined && skipped === undefined) return undefined;
  return {
    ...(repeated !== undefined && { repeated }),
    ...(skipped !== undefined && { skipped }),
  };
}

/** A production day that is not 24 hours long, because the clocks change in it. */
export interface UnevenProductionDay {
  /** The plant date the production day starts on. */
  readonly date: string;
  readonly hours: number;
}

/**
 * The first production day from an instant on that lasts 23 or 25 hours, because the zone's
 * clocks change during it (ADR 0025, CAL9): with a 06:00 start in Europe/Stockholm, the day of
 * Sat 27 Mar 2027 lasts 23 h. Answers undefined for a zone without clock changes.
 */
export function nextUnevenProductionDay(
  timeZone: string,
  dayStart: string,
  fromMs: number,
): UnevenProductionDay | undefined {
  const start = Temporal.PlainTime.from(dayStart);
  const transition = Temporal.Instant.fromEpochMilliseconds(fromMs)
    .toZonedDateTimeISO(timeZone)
    .getTimeZoneTransition('next');
  if (transition === null) return undefined;
  // The production day that holds the change starts on the change's date, or on the day before
  // when the change comes before the day start.
  let date = transition.toPlainDate();
  if (Temporal.PlainTime.compare(transition.toPlainTime(), start) < 0) {
    date = date.subtract({ days: 1 });
  }
  const begins = date.toPlainDateTime(start).toZonedDateTime(timeZone);
  const ends = date.add({ days: 1 }).toPlainDateTime(start).toZonedDateTime(timeZone);
  return { date: date.toString(), hours: begins.until(ends, { largestUnit: 'hours' }).hours };
}
