import { DateTime, Interval } from "luxon";

/*
 * The calendar capacity rule, as pure functions: capacity at an instant is
 * the winning bucket's value (lowest priority among the
 * matching buckets, the calendar's default when none matches) unless an
 * exception overlaps the instant, in which case the exception's value wins
 * outright.
 *
 * Buckets are wall-clock windows in the calendar's zone and are resolved to
 * instants here, through Luxon and nowhere else (ADR-006). That is what
 * keeps a 06:00 shift at 06:00 on both sides of a daylight-saving change and
 * makes the day's capacity come out in real seconds: 23 hours on the spring
 * day, 25 on the autumn one. The spec beside this file walks both.
 */

/**
 * What a calendar contributes to the rules: its zone, and the fallback the
 * version in force states. The zone belongs to the family and the fallback to
 * one version of it, so a caller builds this pair from both (O-5).
 */
export interface CalendarRule {
  readonly timeZone: string;
  readonly defaultValue: number;
}

/** A version as the rules read it: when it starts, and what it falls back on. */
export interface VersionRule {
  /** A plain calendar day in the calendar's zone, `yyyy-MM-dd`. */
  readonly effectiveFrom: string;
  readonly defaultValue: number;
}

/**
 * The version in force on one of the plant's days: the latest one whose
 * `effectiveFrom` is on or before that day, or null before the first version
 * starts, which reads as a calendar with nothing to say and so as closed.
 *
 * The comparison is between two plain dates in the plant's zone and never
 * between instants. That is the point of the DATE column: on the two nights
 * the clocks move, the instant a plant's day begins shifts by an hour, and a
 * boundary measured in instants would hand back the wrong version for that
 * hour. The date the caller passes is the plant's own day (an instant is
 * turned into one with `setZone(zone).toISODate()` first), so `zone` is here
 * to read that date in, not to shift it.
 */
export function versionInForce<Version extends VersionRule>(
  versions: readonly Version[],
  isoDate: string,
  zone: string,
): Version | null {
  const day = DateTime.fromISO(isoDate, { zone }).toISODate();
  if (day === null) {
    return null;
  }

  return (
    versions
      .filter((version) => version.effectiveFrom <= day)
      .toSorted((left, right) =>
        left.effectiveFrom.localeCompare(right.effectiveFrom),
      )
      .at(-1) ?? null
  );
}

/**
 * Whether a calendar day is a Monday. A week's pattern is drawn Monday to
 * Sunday, so a version that starts on another weekday splits a week in two and
 * is only accepted once the person confirms it (O-5). A date that is not a
 * calendar day is not a Monday; the schema refuses it a step earlier.
 */
export function isMondayInZone(isoDate: string): boolean {
  const day = DateTime.fromISO(isoDate, { zone: "utc" });

  return day.isValid && day.weekday === 1;
}

/** A bucket as the rules read it; the service maps rows onto this shape. */
export interface BucketRule {
  readonly label: string | null;
  /** frePPLe's bitmask, Monday = 1 through Sunday = 64. */
  readonly weekdayMask: number;
  /** Wall-clock `HH:mm` in the calendar's zone. */
  readonly startTime: string;
  readonly endTime: string;
  readonly value: number;
  readonly priority: number;
  /** Plain calendar days, `yyyy-MM-dd`, bounding the bucket's validity. */
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

/** An exception as the rules read it: one concrete interval. */
export interface ExceptionRule {
  readonly startsAt: DateTime;
  /** Null lasts until further notice. */
  readonly endsAt: DateTime | null;
  readonly value: number;
}

/** One resolved window of one calendar day, as instants. */
export interface CapacityWindow {
  readonly startsAt: DateTime;
  readonly endsAt: DateTime;
  readonly value: number;
  readonly priority: number;
  readonly label: string | null;
}

/** ISO weekdays, Monday 1 to Sunday 7, as a frePPLe bitmask. */
export function toWeekdayMask(weekdays: readonly number[]): number {
  return weekdays.reduce((mask, weekday) => mask | (1 << (weekday - 1)), 0);
}

/** The ISO weekdays a bitmask names, ascending. */
export function weekdaysOf(mask: number): number[] {
  return [1, 2, 3, 4, 5, 6, 7].filter(
    (weekday) => (mask & (1 << (weekday - 1))) !== 0,
  );
}

function coversWeekday(bucket: BucketRule, weekday: number): boolean {
  return (bucket.weekdayMask & (1 << (weekday - 1))) !== 0;
}

function isValidOn(bucket: BucketRule, isoDate: string): boolean {
  return (
    (bucket.validFrom === null || isoDate >= bucket.validFrom) &&
    (bucket.validTo === null || isoDate <= bucket.validTo)
  );
}

/**
 * A wall-clock time on a calendar day as an instant in the zone.
 *
 * Luxon resolves a time that does not exist (the spring gap) by moving
 * forward to the next valid instant, and a time that exists twice (the
 * autumn overlap) to its first occurrence. Both are what a shift plan means:
 * a 02:30 start on the spring night starts when 03:00 arrives, and a window
 * whose end falls in the repeated hour ends at the first 03:00 and so keeps
 * the repeated hour open.
 */
function wallClock(zone: string, isoDate: string, time: string): DateTime {
  return DateTime.fromISO(`${isoDate}T${time}`, { zone });
}

/**
 * The bucket windows of one calendar day, as instants, in priority order
 * (lowest first). The day is the plant's day, so its weekday and its
 * validity are read off the local date.
 */
export function bucketWindowsOn(
  calendar: CalendarRule,
  buckets: readonly BucketRule[],
  isoDate: string,
): CapacityWindow[] {
  const weekday = DateTime.fromISO(isoDate, {
    zone: calendar.timeZone,
  }).weekday;

  return buckets
    .filter(
      (bucket) => coversWeekday(bucket, weekday) && isValidOn(bucket, isoDate),
    )
    .map((bucket) => ({
      startsAt: wallClock(calendar.timeZone, isoDate, bucket.startTime),
      endsAt: wallClock(calendar.timeZone, isoDate, bucket.endTime),
      value: bucket.value,
      priority: bucket.priority,
      label: bucket.label,
    }))
    .filter((window) => window.endsAt > window.startsAt)
    .toSorted((a, b) => a.priority - b.priority);
}

/** The windows of one day, buckets first, then the exceptions overlapping it. */
export function capacityWindowsOn(
  calendar: CalendarRule,
  buckets: readonly BucketRule[],
  exceptions: readonly ExceptionRule[],
  isoDate: string,
): CapacityWindow[] {
  const day = DateTime.fromISO(isoDate, { zone: calendar.timeZone }).startOf(
    "day",
  );
  const dayInterval = Interval.fromDateTimes(day, day.plus({ days: 1 }));

  const exceptionWindows = exceptions
    .map((exception): CapacityWindow | null => {
      const clipped = Interval.fromDateTimes(
        exception.startsAt,
        exception.endsAt ?? dayInterval.end ?? exception.startsAt,
      ).intersection(dayInterval);

      return clipped?.isValid && clipped.start && clipped.end
        ? {
            startsAt: clipped.start,
            endsAt: clipped.end,
            value: exception.value,
            priority: -1,
            label: null,
          }
        : null;
    })
    .filter((window): window is CapacityWindow => window !== null);

  return [...bucketWindowsOn(calendar, buckets, isoDate), ...exceptionWindows];
}

/**
 * Capacity at one instant: the exception that covers it, else the winning
 * bucket, else the default. Among overlapping exceptions the latest to start
 * wins, on the reading that the most recent decision is the current one.
 */
export function capacityAt(
  calendar: CalendarRule,
  buckets: readonly BucketRule[],
  exceptions: readonly ExceptionRule[],
  instant: DateTime,
): number {
  const covering = exceptions
    .filter(
      (exception) =>
        exception.startsAt <= instant &&
        (exception.endsAt === null || instant < exception.endsAt),
    )
    .toSorted((a, b) => b.startsAt.toMillis() - a.startsAt.toMillis());
  const exception = covering[0];
  if (exception !== undefined) {
    return exception.value;
  }

  const local = instant.setZone(calendar.timeZone);
  const isoDate = local.toISODate();
  if (isoDate === null) {
    return calendar.defaultValue;
  }

  const window = bucketWindowsOn(calendar, buckets, isoDate).find(
    (candidate) => candidate.startsAt <= instant && instant < candidate.endsAt,
  );

  return window === undefined ? calendar.defaultValue : window.value;
}

/** One stretch of open time on one calendar day, as instants. Half open: the end is not open. */
export interface OpenSpan {
  readonly startsAt: DateTime;
  readonly endsAt: DateTime;
}

/**
 * The open stretches of one calendar day, earliest first, adjacent ones
 * joined.
 *
 * The day's windows come from `capacityWindowsOn`, but a window is not an
 * answer on its own: a break bucket and the shift it sits inside overlap,
 * and an exception beats both. So the day is cut at every window edge and
 * each piece is asked `capacityAt`, which is the one arbiter of that
 * precedence (the lowest priority number among the buckets, an exception
 * over all of them, the default where nothing matches). A piece with
 * capacity above zero is open. The day runs from local midnight to local
 * midnight, which is 23 hours in the spring and 25 in the autumn.
 */
export function openSpansOn(
  calendar: CalendarRule,
  buckets: readonly BucketRule[],
  exceptions: readonly ExceptionRule[],
  isoDate: string,
): OpenSpan[] {
  const dayStart = DateTime.fromISO(isoDate, {
    zone: calendar.timeZone,
  }).startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });
  const windows = capacityWindowsOn(calendar, buckets, exceptions, isoDate);

  const edges: DateTime[] = [dayStart, dayEnd];
  for (const window of windows) {
    for (const edge of [window.startsAt, window.endsAt]) {
      if (edge > dayStart && edge < dayEnd) {
        edges.push(edge);
      }
    }
  }
  const ordered = edges.toSorted((a, b) => a.toMillis() - b.toMillis());

  const spans: OpenSpan[] = [];
  for (const [index, startsAt] of ordered.entries()) {
    const endsAt = ordered[index + 1];
    if (endsAt === undefined || endsAt <= startsAt) {
      continue;
    }
    if (capacityAt(calendar, buckets, exceptions, startsAt) <= 0) {
      continue;
    }
    const previous = spans.at(-1);
    if (previous?.endsAt.equals(startsAt)) {
      spans[spans.length - 1] = { startsAt: previous.startsAt, endsAt };
      continue;
    }
    spans.push({ startsAt, endsAt });
  }

  return spans;
}

/**
 * How many real seconds of capacity one calendar day carries: the sum of
 * its open spans, so it agrees with `capacityAt` at every instant. A break
 * carried as a zero-value bucket that wins on priority closes the time it
 * covers; a closed exception closes what it covers and an opening one adds
 * what it covers; a default above zero opens what no bucket names. Measured
 * in instants, so the day the clocks move comes out an hour short or an
 * hour long, as it should.
 */
export function openSecondsOn(
  calendar: CalendarRule,
  buckets: readonly BucketRule[],
  exceptions: readonly ExceptionRule[],
  isoDate: string,
): number {
  return openSpansOn(calendar, buckets, exceptions, isoDate).reduce(
    (total, span) => total + span.endsAt.diff(span.startsAt, "seconds").seconds,
    0,
  );
}
