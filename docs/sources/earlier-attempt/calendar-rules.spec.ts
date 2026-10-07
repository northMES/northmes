import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  type BucketRule,
  capacityAt,
  capacityWindowsOn,
  type ExceptionRule,
  isMondayInZone,
  openSecondsOn,
  toWeekdayMask,
  versionInForce,
  weekdaysOf,
} from "./calendar-rules.js";

const ZONE = "Europe/Stockholm";
const calendar = { timeZone: ZONE, defaultValue: 0 };

function bucket(overrides: Partial<BucketRule> = {}): BucketRule {
  return {
    label: "Day shift",
    weekdayMask: toWeekdayMask([1, 2, 3, 4, 5]),
    startTime: "06:00",
    endTime: "14:30",
    value: 1,
    priority: 100,
    validFrom: null,
    validTo: null,
    ...overrides,
  };
}

function exception(overrides: Partial<ExceptionRule> = {}): ExceptionRule {
  return {
    startsAt: DateTime.fromISO("2026-09-07T06:00", { zone: ZONE }),
    endsAt: DateTime.fromISO("2026-09-07T12:00", { zone: ZONE }),
    value: 0,
    ...overrides,
  };
}

const at = (local: string) => DateTime.fromISO(local, { zone: ZONE });

describe("weekday masks", () => {
  it("round-trips ISO weekdays through the frePPLe bitmask", () => {
    expect(toWeekdayMask([1, 2, 3, 4, 5])).toBe(31);
    expect(toWeekdayMask([6])).toBe(32);
    expect(toWeekdayMask([7])).toBe(64);
    expect(weekdaysOf(127)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekdaysOf(toWeekdayMask([2, 7]))).toEqual([2, 7]);
  });
});

describe("capacityAt", () => {
  it("answers the bucket's value inside its window and the default outside", () => {
    const buckets = [bucket()];

    expect(capacityAt(calendar, buckets, [], at("2026-09-07T09:00"))).toBe(1);
    expect(capacityAt(calendar, buckets, [], at("2026-09-07T05:59"))).toBe(0);
    expect(capacityAt(calendar, buckets, [], at("2026-09-07T14:30"))).toBe(0);
  });

  it("opens only on the bucket's weekdays", () => {
    const buckets = [bucket()];

    // 2026-09-05 is a Saturday.
    expect(capacityAt(calendar, buckets, [], at("2026-09-05T09:00"))).toBe(0);
  });

  it("lets the lowest priority win among overlapping buckets", () => {
    const buckets = [
      bucket({ value: 1, priority: 100 }),
      bucket({ label: "Reduced", value: 0.5, priority: 10 }),
    ];

    expect(capacityAt(calendar, buckets, [], at("2026-09-07T09:00"))).toBe(0.5);
  });

  it("honours a bucket's validity window in the plant's calendar days", () => {
    const buckets = [
      bucket({
        label: "Saturday overtime",
        weekdayMask: toWeekdayMask([6]),
        validFrom: "2026-08-15",
        validTo: "2026-09-27",
      }),
    ];

    expect(capacityAt(calendar, buckets, [], at("2026-09-05T09:00"))).toBe(1);
    expect(capacityAt(calendar, buckets, [], at("2026-10-03T09:00"))).toBe(0);
  });

  it("lets an exception win outright over the buckets", () => {
    const buckets = [bucket()];

    expect(
      capacityAt(calendar, buckets, [exception()], at("2026-09-07T09:00")),
    ).toBe(0);
    expect(
      capacityAt(
        calendar,
        buckets,
        [exception({ value: 2 })],
        at("2026-09-07T09:00"),
      ),
    ).toBe(2);
    expect(
      capacityAt(calendar, buckets, [exception()], at("2026-09-07T13:00")),
    ).toBe(1);
  });

  it("reads an open-ended exception as lasting until further notice", () => {
    expect(
      capacityAt(
        calendar,
        [bucket()],
        [exception({ endsAt: null })],
        at("2026-12-01T09:00"),
      ),
    ).toBe(0);
  });

  it("evaluates the instant in the calendar's zone, not the caller's", () => {
    // 04:00 UTC is 06:00 in Stockholm in September: the shift has started.
    const utc = DateTime.fromISO("2026-09-07T04:00:00Z");

    expect(capacityAt(calendar, [bucket()], [], utc)).toBe(1);
    expect(
      capacityAt(calendar, [bucket()], [], utc.minus({ minutes: 1 })),
    ).toBe(0);
  });
});

describe("openSecondsOn", () => {
  it("adds a day's buckets without counting a shared boundary twice", () => {
    const buckets = [
      bucket({ startTime: "06:00", endTime: "14:30" }),
      bucket({ label: "Evening", startTime: "14:30", endTime: "23:00" }),
    ];

    expect(openSecondsOn(calendar, buckets, [], "2026-09-07")).toBe(17 * 3600);
  });

  it("closes the minutes an exception covers and opens the ones it adds", () => {
    const buckets = [bucket()];

    expect(openSecondsOn(calendar, buckets, [exception()], "2026-09-07")).toBe(
      2.5 * 3600,
    );
    expect(
      openSecondsOn(calendar, [], [exception({ value: 1 })], "2026-09-07"),
    ).toBe(6 * 3600);
  });

  it("closes the time a break bucket covers when its priority wins, as capacityAt does", () => {
    // A day shift of 06:00 to 14:00 with a break 10:00 to 10:30 as a
    // zero-value bucket at a lower priority number. The day is 7.5 hours, not 8.
    const buckets = [
      bucket({ startTime: "06:00", endTime: "14:00" }),
      bucket({
        label: "Break",
        startTime: "10:00",
        endTime: "10:30",
        value: 0,
        priority: 10,
      }),
    ];

    expect(capacityAt(calendar, buckets, [], at("2026-09-07T10:15"))).toBe(0);
    expect(openSecondsOn(calendar, buckets, [], "2026-09-07")).toBe(7.5 * 3600);
  });

  it("leaves a break bucket that loses on priority without effect", () => {
    const buckets = [
      bucket({ startTime: "06:00", endTime: "14:00" }),
      bucket({
        label: "Break",
        startTime: "10:00",
        endTime: "10:30",
        value: 0,
        priority: 200,
      }),
    ];

    expect(capacityAt(calendar, buckets, [], at("2026-09-07T10:15"))).toBe(1);
    expect(openSecondsOn(calendar, buckets, [], "2026-09-07")).toBe(8 * 3600);
  });

  it("lets an opening exception win back the break it covers", () => {
    const buckets = [
      bucket({ startTime: "06:00", endTime: "14:00" }),
      bucket({
        label: "Break",
        startTime: "10:00",
        endTime: "10:30",
        value: 0,
        priority: 10,
      }),
    ];
    const workedBreak = exception({
      startsAt: at("2026-09-07T10:00"),
      endsAt: at("2026-09-07T10:30"),
      value: 1,
    });

    expect(openSecondsOn(calendar, buckets, [workedBreak], "2026-09-07")).toBe(
      8 * 3600,
    );
  });

  it("opens what no bucket names when the default is above zero", () => {
    const open = { timeZone: ZONE, defaultValue: 1 };

    expect(openSecondsOn(open, [], [], "2026-09-07")).toBe(24 * 3600);
    expect(openSecondsOn(open, [bucket({ value: 0 })], [], "2026-09-07")).toBe(
      15.5 * 3600,
    );
  });
});

/*
 * Daylight saving (ADR-006 amendment). Europe/Stockholm springs forward on
 * 2026-03-29 (02:00 to 03:00 does not exist; the day has 23 hours) and falls
 * back on 2026-10-25 (02:00 to 03:00 happens twice; the day has 25 hours).
 * A wall-clock bucket keeps its clock time across both; the capacity a day
 * carries is measured in real seconds.
 */
describe("the spring transition, 2026-03-29", () => {
  it("keeps a 06:00 shift at 06:00, which is an hour earlier in UTC", () => {
    const [window] = capacityWindowsOn(
      calendar,
      [bucket({ weekdayMask: 127 })],
      [],
      "2026-03-29",
    );

    expect(window?.startsAt.toUTC().toISO()).toBe("2026-03-29T04:00:00.000Z");
    expect(window?.endsAt.toUTC().toISO()).toBe("2026-03-29T12:30:00.000Z");
    expect(
      openSecondsOn(calendar, [bucket({ weekdayMask: 127 })], [], "2026-03-29"),
    ).toBe(8.5 * 3600);
  });

  it("gives a bucket across the missing hour one hour less", () => {
    const night = [
      bucket({
        label: "Night",
        weekdayMask: 127,
        startTime: "01:00",
        endTime: "04:00",
      }),
    ];

    expect(openSecondsOn(calendar, night, [], "2026-03-29")).toBe(2 * 3600);
    expect(openSecondsOn(calendar, night, [], "2026-03-28")).toBe(3 * 3600);
  });

  it("gives a bucket that lies entirely inside the missing hour nothing", () => {
    const gap = [
      bucket({
        label: "Gap",
        weekdayMask: 127,
        startTime: "02:00",
        endTime: "03:00",
      }),
    ];

    expect(openSecondsOn(calendar, gap, [], "2026-03-29")).toBe(0);
  });

  it("takes nothing off a night shift for a break that falls in the missing hour", () => {
    const night = [
      bucket({
        label: "Night",
        weekdayMask: 127,
        startTime: "01:00",
        endTime: "04:00",
      }),
      bucket({
        label: "Break",
        weekdayMask: 127,
        startTime: "02:00",
        endTime: "03:00",
        value: 0,
        priority: 10,
      }),
    ];

    expect(openSecondsOn(calendar, night, [], "2026-03-29")).toBe(2 * 3600);
    expect(openSecondsOn(calendar, night, [], "2026-03-28")).toBe(2 * 3600);
  });

  it("counts 23 real hours for a default that is open around the clock", () => {
    expect(
      openSecondsOn({ timeZone: ZONE, defaultValue: 1 }, [], [], "2026-03-29"),
    ).toBe(23 * 3600);
  });
});

describe("the autumn transition, 2026-10-25", () => {
  it("keeps a 06:00 shift at 06:00, which is an hour later in UTC", () => {
    const [window] = capacityWindowsOn(
      calendar,
      [bucket({ weekdayMask: 127 })],
      [],
      "2026-10-25",
    );

    expect(window?.startsAt.toUTC().toISO()).toBe("2026-10-25T05:00:00.000Z");
    expect(
      openSecondsOn(calendar, [bucket({ weekdayMask: 127 })], [], "2026-10-25"),
    ).toBe(8.5 * 3600);
  });

  it("gives a bucket across the repeated hour one hour more", () => {
    const night = [
      bucket({
        label: "Night",
        weekdayMask: 127,
        startTime: "01:00",
        endTime: "04:00",
      }),
    ];

    expect(openSecondsOn(calendar, night, [], "2026-10-25")).toBe(4 * 3600);
    expect(openSecondsOn(calendar, night, [], "2026-10-24")).toBe(3 * 3600);
  });

  it("counts both passes of 02:30 as open", () => {
    const night = [
      bucket({
        label: "Night",
        weekdayMask: 127,
        startTime: "01:00",
        endTime: "04:00",
      }),
    ];
    const firstPass = DateTime.fromISO("2026-10-25T00:30:00Z"); // 02:30 CEST
    const secondPass = DateTime.fromISO("2026-10-25T01:30:00Z"); // 02:30 CET

    expect(capacityAt(calendar, night, [], firstPass)).toBe(1);
    expect(capacityAt(calendar, night, [], secondPass)).toBe(1);
  });

  it("closes both passes of 02:30 for a break across the repeated hour", () => {
    // The break's 02:00 is the first pass and its 03:00 is the one 03:00 of
    // the night, so the break is two real hours and the shift keeps two.
    const night = [
      bucket({
        label: "Night",
        weekdayMask: 127,
        startTime: "01:00",
        endTime: "04:00",
      }),
      bucket({
        label: "Break",
        weekdayMask: 127,
        startTime: "02:00",
        endTime: "03:00",
        value: 0,
        priority: 10,
      }),
    ];
    const firstPass = DateTime.fromISO("2026-10-25T00:30:00Z"); // 02:30 CEST
    const secondPass = DateTime.fromISO("2026-10-25T01:30:00Z"); // 02:30 CET

    expect(capacityAt(calendar, night, [], firstPass)).toBe(0);
    expect(capacityAt(calendar, night, [], secondPass)).toBe(0);
    expect(openSecondsOn(calendar, night, [], "2026-10-25")).toBe(2 * 3600);
    expect(openSecondsOn(calendar, night, [], "2026-10-24")).toBe(2 * 3600);
  });

  it("counts 25 real hours for a default that is open around the clock", () => {
    expect(
      openSecondsOn({ timeZone: ZONE, defaultValue: 1 }, [], [], "2026-10-25"),
    ).toBe(25 * 3600);
  });
});

/*
 * Version resolution (O-5). A calendar is a family and its pattern lives in
 * versions, each in force from a plain date in the plant's zone until the
 * next one starts. The dates below sit on either side of both Stockholm
 * clock changes, because the boundary is a wall-clock date and the instant a
 * day begins moves by an hour twice a year: a resolution that read instants
 * would pick the wrong version for a few hours on those two nights.
 */

const versions = [
  { effectiveFrom: "2026-01-05", defaultValue: 0 },
  { effectiveFrom: "2026-03-30", defaultValue: 1 },
  { effectiveFrom: "2026-10-26", defaultValue: 2 },
];

describe("versionInForce", () => {
  it("answers null before the first version starts", () => {
    expect(versionInForce(versions, "2026-01-04", ZONE)).toBeNull();
    expect(versionInForce([], "2026-09-07", ZONE)).toBeNull();
  });

  it("answers the latest version whose date has arrived, whatever the list order", () => {
    expect(versionInForce(versions, "2026-01-05", ZONE)?.defaultValue).toBe(0);
    expect(versionInForce(versions, "2026-06-01", ZONE)?.defaultValue).toBe(1);
    expect(
      versionInForce(versions.toReversed(), "2026-06-01", ZONE)?.defaultValue,
    ).toBe(1);
    expect(versionInForce(versions, "2030-01-01", ZONE)?.defaultValue).toBe(2);
  });

  it("switches on the Monday of the spring transition, not before", () => {
    // Sunday 2026-03-29 is the short night; the version starting the next
    // morning is not in force until that Monday's own date.
    expect(versionInForce(versions, "2026-03-29", ZONE)?.defaultValue).toBe(0);
    expect(versionInForce(versions, "2026-03-30", ZONE)?.defaultValue).toBe(1);
  });

  it("switches on the Monday of the autumn transition, not before", () => {
    // Sunday 2026-10-25 is the long night, 25 hours in Stockholm.
    expect(versionInForce(versions, "2026-10-25", ZONE)?.defaultValue).toBe(1);
    expect(versionInForce(versions, "2026-10-26", ZONE)?.defaultValue).toBe(2);
  });

  it("reads the date in the plant's zone, so an instant near midnight lands on the plant's day", () => {
    // 2026-03-29T23:30Z is already Monday 00:30 in Stockholm (CEST).
    const local = at("2026-03-30T00:30").toISODate() ?? "";

    expect(versionInForce(versions, local, ZONE)?.defaultValue).toBe(1);
  });

  it("refuses a date that is not a calendar day", () => {
    expect(versionInForce(versions, "next monday", ZONE)).toBeNull();
  });
});

describe("isMondayInZone", () => {
  it("knows the Mondays a week's pattern may start on", () => {
    expect(isMondayInZone("2026-01-05")).toBe(true);
    expect(isMondayInZone("2026-03-30")).toBe(true);
    expect(isMondayInZone("2026-10-26")).toBe(true);
  });

  it("says no to every other weekday, and to a date it cannot read", () => {
    expect(isMondayInZone("2026-01-08")).toBe(false);
    expect(isMondayInZone("2026-03-29")).toBe(false);
    expect(isMondayInZone("not a date")).toBe(false);
  });
});
