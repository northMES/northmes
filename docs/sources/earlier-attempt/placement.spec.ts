import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  type BucketRule,
  type ExceptionRule,
  openSecondsOn,
  toWeekdayMask,
} from "./calendar-rules.js";
import {
  type AutoplanLane,
  type AutoplanRow,
  advance,
  autoplan,
  estimate,
  type PlacementCalendar,
  type PlacementRates,
  productionSeconds,
} from "./placement.js";

const ZONE = "Europe/Stockholm";

const at = (local: string) => DateTime.fromISO(local, { zone: ZONE });

/** Both sides read in the plant's zone, so a failure prints a clock time. */
function local(instant: DateTime | null): string | null {
  return instant === null ? null : (instant.setZone(ZONE).toISO() ?? null);
}

function bucket(overrides: Partial<BucketRule> = {}): BucketRule {
  return {
    label: null,
    weekdayMask: toWeekdayMask([1, 2, 3, 4, 5]),
    startTime: "06:00",
    endTime: "15:00",
    value: 1,
    priority: 100,
    validFrom: null,
    validTo: null,
    ...overrides,
  };
}

/**
 * The A1 calendar of NorthMES ADR 0027: Monday to Friday 06:00 to 15:00,
 * breaks 08:30 to 08:45 and 11:00 to 11:30 carried as zero-value buckets at
 * a lower priority, so they win over the day shift and the day is worth
 * 8.25 open hours, 29 700 seconds.
 */
function a1Calendar(
  exceptions: readonly ExceptionRule[] = [],
): PlacementCalendar {
  return {
    calendar: { timeZone: ZONE, defaultValue: 0 },
    buckets: [
      bucket({ label: "Day shift" }),
      bucket({
        label: "Break",
        startTime: "08:30",
        endTime: "08:45",
        value: 0,
        priority: 10,
      }),
      bucket({
        label: "Lunch",
        startTime: "11:00",
        endTime: "11:30",
        value: 0,
        priority: 10,
      }),
    ],
    exceptions,
  };
}

/** No buckets and a default above zero: open around the clock, every day. */
const alwaysOpen: PlacementCalendar = {
  calendar: { timeZone: ZONE, defaultValue: 1 },
  buckets: [],
  exceptions: [],
};

/** Nothing open ever: the calendar a walk must give up on. */
const neverOpen: PlacementCalendar = {
  calendar: { timeZone: ZONE, defaultValue: 0 },
  buckets: [],
  exceptions: [],
};

function rates(overrides: Partial<PlacementRates> = {}): PlacementRates {
  return {
    cycleSeconds: 0,
    partsPerCycle: 1,
    setupSeconds: 0,
    targetOeePercent: 100,
    fixedSeconds: 0,
    leadTimeSeconds: 0,
    ...overrides,
  };
}

/**
 * A row whose whole duration is the fixed term, with a cycle time of zero.
 * That is the shape of a row that carries only a setup time, and it lets a
 * calendar test name the seconds it wants to stretch without inventing a
 * quantity to reach them.
 */
function fixedRates(
  seconds: number,
  overrides: Partial<PlacementRates> = {},
): PlacementRates {
  return rates({ fixedSeconds: seconds, ...overrides });
}

/** The TC1 rates of NorthMES ADR 0027, with its 2 700 s retool as the setup. */
const tc1 = rates({
  cycleSeconds: 45,
  partsPerCycle: 3,
  setupSeconds: 2_700,
  targetOeePercent: 75,
});

describe("productionSeconds", () => {
  it("answers TC1: 7 200 pieces, 45 s, three per cycle, OEE 75", () => {
    // 7 200 over three parts is 2 400 cycles, 2 400 times 45 s is 108 000 s,
    // and 108 000 over 0,75 is 144 000 s.
    expect(productionSeconds(tc1, 7_200)).toBe(144_000);
  });

  it("adds the fixed term after the quantity has been scaled", () => {
    const withFixed = rates({
      cycleSeconds: 45,
      partsPerCycle: 3,
      targetOeePercent: 75,
      fixedSeconds: 1_200,
    });

    expect(productionSeconds(withFixed, 7_200)).toBe(145_200);
  });

  it("runs one cycle per piece when parts per cycle is one", () => {
    const perPiece = rates({ cycleSeconds: 1_500 });

    expect(productionSeconds(perPiece, 4)).toBe(6_000);
    expect(productionSeconds(rates({ cycleSeconds: 1_500 }), 1)).toBe(1_500);
  });

  it("reads a missing rate as one part per cycle and a full OEE", () => {
    const missing = rates({
      cycleSeconds: 45,
      partsPerCycle: 0,
      targetOeePercent: 0,
    });

    expect(productionSeconds(missing, 10)).toBe(450);
    expect(productionSeconds(missing, 0)).toBe(0);
  });
});

/*
 * TC1 end to end. Setup 2 700 s from Monday 2026-11-02 06:00 fills 06:00 to
 * 06:45; production is 144 000 s, which is 4 open days and 25 200 s at
 * 29 700 s a day. Counted off the calendar from Monday 06:45: Monday leaves
 * 27 000 s, Tuesday to Thursday 89 100 s (116 100). The last 27 900 s run on
 * Friday the 6th: 9 000 s before the break, 8 100 s before lunch and
 * 10 800 s after it, which ends at 14:30. The nights and the breaks in
 * between are 229 500 closed seconds.
 */
describe("TC1 on the A1 calendar", () => {
  it("places the setup, the production and the end within one week", () => {
    const window = estimate(
      tc1,
      7_200,
      { startAt: at("2026-11-02T06:00") },
      a1Calendar(),
    );

    expect(window.setupSeconds).toBe(2_700);
    expect(window.productionSeconds).toBe(144_000);
    expect(local(window.setupStartAt)).toBe(local(at("2026-11-02T06:00")));
    expect(local(window.startAt)).toBe(local(at("2026-11-02T06:45")));
    expect(local(window.endAt)).toBe(local(at("2026-11-06T14:30")));
  });

  it("measures the wall time from the setup start and the closed time inside it", () => {
    const window = estimate(
      tc1,
      7_200,
      { startAt: at("2026-11-02T06:00") },
      a1Calendar(),
    );

    expect(window.elapsedSeconds).toBe(
      window.endAt.diff(at("2026-11-02T06:00"), "seconds").seconds,
    );
    expect(window.elapsedSeconds).toBe(376_200);
    // 376 200 wall seconds less the 2 700 of setup and the 144 000 of
    // production leaves the nights and the breaks.
    expect(window.closedSeconds).toBe(229_500);
  });

  it("is worth 29 700 seconds a day, the break buckets taken off the shift", () => {
    const calendar = a1Calendar();

    // The day's hours and the walk across them are the same spans.
    expect(
      openSecondsOn(
        calendar.calendar,
        calendar.buckets,
        calendar.exceptions,
        "2026-11-02",
      ),
    ).toBe(29_700);
    expect(
      local(advance(calendar, at("2026-11-02T06:00"), 29_700, "FORWARD")),
    ).toBe(local(at("2026-11-02T15:00")));
    expect(
      local(advance(calendar, at("2026-11-02T06:00"), 9_000, "FORWARD")),
    ).toBe(local(at("2026-11-02T08:30")));
    expect(
      local(advance(calendar, at("2026-11-02T06:00"), 9_001, "FORWARD")),
    ).toBe(local(at("2026-11-02T08:45:01")));
  });

  it("gives up on a calendar with nothing open, naming it", () => {
    expect(() =>
      estimate(tc1, 7_200, { startAt: at("2026-11-02T06:00") }, neverOpen),
    ).toThrow(/Europe\/Stockholm/);
  });
});

/*
 * Two short rows whose own instants pin the calendars: the first runs 09:40
 * to 11:20 on 2026-02-11, so the shop is open around the middle of that
 * Wednesday and 06:00 to 22:00 carries it; the second starts at 20:00 and
 * ends 08:30 the next morning, which is the shift that closes at 22:00 and
 * opens again at 06:30, the two hours it still owes running from 06:30.
 */
describe("two rows on long single shifts", () => {
  const dayShift: PlacementCalendar = {
    calendar: { timeZone: ZONE, defaultValue: 0 },
    buckets: [bucket({ startTime: "06:00", endTime: "22:00" })],
    exceptions: [],
  };
  const lateShift: PlacementCalendar = {
    calendar: { timeZone: ZONE, defaultValue: 0 },
    buckets: [bucket({ startTime: "06:30", endTime: "22:00" })],
    exceptions: [],
  };

  it("fills 09:40 to 11:20 with four pieces at 1 500 s", () => {
    const window = estimate(
      rates({ cycleSeconds: 1_500 }),
      4,
      { startAt: at("2026-02-11T09:40") },
      dayShift,
    );

    expect(window.productionSeconds).toBe(6_000);
    expect(window.setupStartAt).toBeNull();
    expect(local(window.startAt)).toBe(local(at("2026-02-11T09:40")));
    expect(local(window.endAt)).toBe(local(at("2026-02-11T11:20")));
    expect(window.closedSeconds).toBe(0);
  });

  it("stretches twelve pieces at 1 200 s from 20:00 across the night closure", () => {
    const window = estimate(
      rates({ cycleSeconds: 1_200 }),
      12,
      { startAt: at("2026-02-11T20:00") },
      lateShift,
    );

    expect(window.productionSeconds).toBe(14_400);
    expect(local(window.endAt)).toBe(local(at("2026-02-12T08:30")));
    // Two hours before the shift closes, two more after it opens; the
    // eight and a half hours in between are closed.
    expect(window.closedSeconds).toBe(8.5 * 3_600);
  });
});

describe("placing from an end", () => {
  it("measures TC1's window back from its own end", () => {
    const window = estimate(
      tc1,
      7_200,
      { endAt: at("2026-11-06T14:30") },
      a1Calendar(),
    );

    expect(local(window.setupStartAt)).toBe(local(at("2026-11-02T06:00")));
    expect(local(window.startAt)).toBe(local(at("2026-11-02T06:45")));
    expect(local(window.endAt)).toBe(local(at("2026-11-06T14:30")));
  });

  it("lets the setup sit on the Friday afternoon before a Monday morning start", () => {
    // Five open days of production, 148 500 s, end Friday 2026-11-06 at
    // 15:00: production starts Monday the 2nd at 06:00 and the 45 minutes of
    // setup before it are the end of Friday 2026-10-30, which is open time.
    const window = estimate(
      rates({ cycleSeconds: 297, setupSeconds: 2_700 }),
      500,
      { endAt: at("2026-11-06T15:00") },
      a1Calendar(),
    );

    expect(window.productionSeconds).toBe(148_500);
    expect(local(window.startAt)).toBe(local(at("2026-11-02T06:00")));
    expect(local(window.setupStartAt)).toBe(local(at("2026-10-30T14:15")));
    expect(local(window.endAt)).toBe(local(at("2026-11-06T15:00")));
  });
});

describe("instants that fall in closed time", () => {
  const calendar = a1Calendar();

  it("moves a start forward to the next opening", () => {
    // 2026-01-10 is a Saturday.
    expect(local(advance(calendar, at("2026-01-10T09:00"), 0, "FORWARD"))).toBe(
      local(at("2026-01-12T06:00")),
    );
    expect(local(advance(calendar, at("2026-01-05T11:15"), 0, "FORWARD"))).toBe(
      local(at("2026-01-05T11:30")),
    );
    expect(local(advance(calendar, at("2026-01-05T10:00"), 0, "FORWARD"))).toBe(
      local(at("2026-01-05T10:00")),
    );
  });

  it("moves an end back to the previous closing", () => {
    expect(
      local(advance(calendar, at("2026-01-10T09:00"), 0, "BACKWARD")),
    ).toBe(local(at("2026-01-09T15:00")));
    expect(
      local(advance(calendar, at("2026-01-05T11:15"), 0, "BACKWARD")),
    ).toBe(local(at("2026-01-05T11:00")));
    expect(
      local(advance(calendar, at("2026-01-05T15:00"), 0, "BACKWARD")),
    ).toBe(local(at("2026-01-05T15:00")));
  });

  it("starts a job dropped on a Saturday on the Monday morning", () => {
    const window = estimate(
      fixedRates(3_600, { setupSeconds: 1_800 }),
      1,
      { startAt: at("2026-01-10T09:00") },
      calendar,
    );

    expect(local(window.setupStartAt)).toBe(local(at("2026-01-12T06:00")));
    expect(local(window.startAt)).toBe(local(at("2026-01-12T06:30")));
    expect(local(window.endAt)).toBe(local(at("2026-01-12T07:30")));
  });
});

describe("an earliest start from the predecessor's lead time", () => {
  const calendar = a1Calendar();
  const withSetup = fixedRates(7_200, { setupSeconds: 3_600 });

  it("holds production back to the earliest start and backs the setup off it", () => {
    const window = estimate(
      withSetup,
      1,
      { startAt: at("2026-01-05T06:00") },
      calendar,
      at("2026-01-05T11:30"),
    );

    expect(local(window.startAt)).toBe(local(at("2026-01-05T11:30")));
    expect(local(window.endAt)).toBe(local(at("2026-01-05T13:30")));
    // An hour of setup measured back from 11:30 skips the lunch break, so it
    // runs 10:00 to 11:00 and the break is the closed time inside the block.
    expect(local(window.setupStartAt)).toBe(local(at("2026-01-05T10:00")));
    expect(window.elapsedSeconds).toBe(12_600);
    expect(window.closedSeconds).toBe(1_800);
  });

  it("leaves an anchor that already clears the earliest start alone", () => {
    const window = estimate(
      withSetup,
      1,
      { startAt: at("2026-01-05T06:00") },
      calendar,
      at("2026-01-05T06:30"),
    );

    expect(local(window.setupStartAt)).toBe(local(at("2026-01-05T06:00")));
    expect(local(window.startAt)).toBe(local(at("2026-01-05T07:00")));
    // Two hours of production from 07:00 run across the 08:30 break.
    expect(local(window.endAt)).toBe(local(at("2026-01-05T09:15")));
  });
});

describe("exceptions", () => {
  it("stretches the end when a zero exception closes a Tuesday afternoon", () => {
    const production = fixedRates(59_400);
    const anchor = { startAt: at("2026-01-05T06:00") };

    const open = estimate(production, 1, anchor, a1Calendar());
    const closed = estimate(
      production,
      1,
      anchor,
      a1Calendar([
        {
          startsAt: at("2026-01-06T12:00"),
          endsAt: at("2026-01-06T15:00"),
          value: 0,
        },
      ]),
    );

    expect(local(open.endAt)).toBe(local(at("2026-01-06T15:00")));
    // The three hours the exception took come off Wednesday morning, around
    // its first break.
    expect(local(closed.endAt)).toBe(local(at("2026-01-07T09:15")));
    // Two days of breaks and one night without the exception; with it, a
    // second night, Wednesday's first break and the closed afternoon itself.
    expect(open.closedSeconds).toBe(59_400);
    expect(closed.closedSeconds).toBe(125_100);
  });

  it("finishes on a Saturday a positive exception opens", () => {
    const production = fixedRates(21_600);
    const anchor = { startAt: at("2026-01-09T12:00") };

    const plain = estimate(production, 1, anchor, a1Calendar());
    const overtime = estimate(
      production,
      1,
      anchor,
      a1Calendar([
        {
          startsAt: at("2026-01-10T08:00"),
          endsAt: at("2026-01-10T12:00"),
          value: 1,
        },
      ]),
    );

    expect(local(plain.endAt)).toBe(local(at("2026-01-12T09:15")));
    expect(local(overtime.endAt)).toBe(local(at("2026-01-10T11:00")));
  });
});

/*
 * Daylight saving in Europe/Stockholm (ADR-006). The night of 2026-03-28 to
 * 2026-03-29 is an hour short, the night of 2026-10-24 to 2026-10-25 an hour
 * long. Open seconds are real seconds either way, so a job that consumes a
 * day of open time comes out an hour later on the clock in spring and an
 * hour earlier in autumn; a shift written 22:00 to 06:00 keeps those clock
 * times and is worth seven hours across the short night and nine across the
 * long one.
 */
describe("the two nights the clocks move", () => {
  const nightShift: PlacementCalendar = {
    calendar: { timeZone: ZONE, defaultValue: 0 },
    buckets: [
      bucket({
        label: "Night, evening half",
        weekdayMask: 127,
        startTime: "22:00",
        endTime: "24:00",
      }),
      bucket({
        label: "Night, morning half",
        weekdayMask: 127,
        startTime: "00:00",
        endTime: "06:00",
      }),
    ],
    exceptions: [],
  };

  it("moves the wall clock forward an hour across the short night", () => {
    const window = estimate(
      fixedRates(86_400),
      1,
      { startAt: at("2026-03-28T12:00") },
      alwaysOpen,
    );

    expect(local(window.endAt)).toBe(local(at("2026-03-29T13:00")));
    expect(window.elapsedSeconds).toBe(86_400);
    expect(window.closedSeconds).toBe(0);
  });

  it("moves the wall clock back an hour across the long night", () => {
    const window = estimate(
      fixedRates(86_400),
      1,
      { startAt: at("2026-10-24T12:00") },
      alwaysOpen,
    );

    expect(local(window.endAt)).toBe(local(at("2026-10-25T11:00")));
    expect(window.elapsedSeconds).toBe(86_400);
    expect(window.closedSeconds).toBe(0);
  });

  it("keeps the 22:00 to 06:00 shift's clock times on the short night", () => {
    expect(
      local(advance(nightShift, at("2026-03-27T22:00"), 28_800, "FORWARD")),
    ).toBe(local(at("2026-03-28T06:00")));
    expect(
      local(advance(nightShift, at("2026-03-28T22:00"), 25_200, "FORWARD")),
    ).toBe(local(at("2026-03-29T06:00")));
    // The hour the night lost is taken from the following night.
    expect(
      local(advance(nightShift, at("2026-03-28T22:00"), 28_800, "FORWARD")),
    ).toBe(local(at("2026-03-29T23:00")));
  });

  it("keeps the 22:00 to 06:00 shift's clock times on the long night", () => {
    expect(
      local(advance(nightShift, at("2026-10-23T22:00"), 28_800, "FORWARD")),
    ).toBe(local(at("2026-10-24T06:00")));
    expect(
      local(advance(nightShift, at("2026-10-24T22:00"), 32_400, "FORWARD")),
    ).toBe(local(at("2026-10-25T06:00")));
    // The extra hour is worked, so a full shift ends an hour before the
    // morning it would have on any other night.
    expect(
      local(advance(nightShift, at("2026-10-24T22:00"), 28_800, "FORWARD")),
    ).toBe(local(at("2026-10-25T05:00")));
  });

  it("consumes the same open seconds measured back from the morning", () => {
    expect(
      local(advance(nightShift, at("2026-03-29T06:00"), 25_200, "BACKWARD")),
    ).toBe(local(at("2026-03-28T22:00")));
    expect(
      local(advance(nightShift, at("2026-10-25T06:00"), 32_400, "BACKWARD")),
    ).toBe(local(at("2026-10-24T22:00")));
  });
});

describe("autoplan", () => {
  const lanes: AutoplanLane[] = [
    { resourceId: "r1", calendar: alwaysOpen },
    { resourceId: "r2", calendar: alwaysOpen },
  ];
  const horizon = {
    startAt: at("2026-02-02T06:00"),
    endAt: at("2026-02-06T18:00"),
  };
  const due = at("2026-02-02T12:00");

  /** Ten pieces at 360 s a piece: an hour of production a row. */
  function row(overrides: Partial<AutoplanRow> & { id: string }): AutoplanRow {
    return {
      workOrderId: "W1",
      sequence: 10,
      quantity: 10,
      priority: 5,
      dueAt: due,
      pinned: false,
      resourceId: "r1",
      rates: rates({ cycleSeconds: 360 }),
      sendAheadQuantity: null,
      startAt: null,
      endAt: null,
      ...overrides,
    };
  }

  const routing = [
    row({ id: "op10", sequence: 10, resourceId: "r1" }),
    row({
      id: "op20",
      sequence: 20,
      resourceId: "r2",
      rates: rates({ cycleSeconds: 360, leadTimeSeconds: 900 }),
    }),
    row({
      id: "op30",
      sequence: 30,
      resourceId: "r1",
      rates: rates({ cycleSeconds: 360, leadTimeSeconds: 1_800 }),
    }),
  ];

  function placed(
    placements: ReturnType<typeof autoplan>,
    id: string,
  ): ReturnType<typeof autoplan>[number] {
    const hit = placements.find((placement) => placement.id === id);
    if (hit === undefined) {
      throw new Error(`No placement for ${id}`);
    }

    return hit;
  }

  it("walks a routing back from the due date, each row before its successor's lead time", () => {
    const placements = autoplan(routing, lanes, "BACKWARD", horizon);

    const op30 = placed(placements, "op30");
    const op20 = placed(placements, "op20");
    const op10 = placed(placements, "op10");

    expect(local(op30.window.endAt)).toBe(local(due));
    expect(local(op30.window.startAt)).toBe(local(at("2026-02-02T11:00")));
    expect(local(op20.window.endAt)).toBe(local(at("2026-02-02T10:30")));
    expect(local(op20.window.startAt)).toBe(local(at("2026-02-02T09:30")));
    expect(local(op10.window.endAt)).toBe(local(at("2026-02-02T09:15")));
    expect(local(op10.window.startAt)).toBe(local(at("2026-02-02T08:15")));
  });

  it("walks the same routing forward from the horizon start", () => {
    const placements = autoplan(routing, lanes, "FORWARD", horizon);

    expect(local(placed(placements, "op10").window.startAt)).toBe(
      local(at("2026-02-02T06:00")),
    );
    expect(local(placed(placements, "op20").window.startAt)).toBe(
      local(at("2026-02-02T07:15")),
    );
    expect(local(placed(placements, "op20").window.endAt)).toBe(
      local(at("2026-02-02T08:15")),
    );
    expect(local(placed(placements, "op30").window.startAt)).toBe(
      local(at("2026-02-02T08:45")),
    );
    expect(local(placed(placements, "op30").window.endAt)).toBe(
      local(at("2026-02-02T09:45")),
    );
  });

  it("numbers each lane's rows from zero in time order", () => {
    const placements = autoplan(routing, lanes, "BACKWARD", horizon);

    expect(placed(placements, "op10").sequenceIndex).toBe(0);
    expect(placed(placements, "op30").sequenceIndex).toBe(1);
    expect(placed(placements, "op20").sequenceIndex).toBe(0);
    expect(placed(placements, "op30").resourceId).toBe("r1");
  });

  it("gives the lane's deadline slot to the lower priority value", () => {
    const placements = autoplan(
      [
        row({ id: "urgent", workOrderId: "W-A", priority: 1 }),
        row({ id: "later", workOrderId: "W-B", priority: 5 }),
      ],
      lanes,
      "BACKWARD",
      horizon,
    );

    expect(local(placed(placements, "urgent").window.endAt)).toBe(local(due));
    expect(local(placed(placements, "later").window.endAt)).toBe(
      local(at("2026-02-02T11:00")),
    );
  });

  it("breaks a tie on priority with the earlier due date", () => {
    const placements = autoplan(
      [
        row({ id: "first", workOrderId: "W-C", dueAt: due }),
        row({
          id: "second",
          workOrderId: "W-D",
          dueAt: at("2026-02-02T12:30"),
        }),
      ],
      lanes,
      "BACKWARD",
      horizon,
    );

    expect(local(placed(placements, "first").window.endAt)).toBe(local(due));
    expect(local(placed(placements, "second").window.endAt)).toBe(
      local(at("2026-02-02T11:00")),
    );
  });

  it("keeps a pinned row's window and flows the others around it", () => {
    const placements = autoplan(
      [
        row({
          id: "pinned",
          workOrderId: "W-P",
          pinned: true,
          startAt: at("2026-02-02T10:00"),
          endAt: at("2026-02-02T11:00"),
        }),
        row({ id: "movable", workOrderId: "W-M", quantity: 20 }),
      ],
      lanes,
      "BACKWARD",
      horizon,
    );

    expect(local(placed(placements, "pinned").window.startAt)).toBe(
      local(at("2026-02-02T10:00")),
    );
    expect(local(placed(placements, "pinned").window.endAt)).toBe(
      local(at("2026-02-02T11:00")),
    );
    expect(local(placed(placements, "movable").window.startAt)).toBe(
      local(at("2026-02-02T08:00")),
    );
    expect(local(placed(placements, "movable").window.endAt)).toBe(
      local(at("2026-02-02T10:00")),
    );
    expect(placed(placements, "movable").sequenceIndex).toBe(0);
    expect(placed(placements, "pinned").sequenceIndex).toBe(1);
  });

  it("leaves a row that started before the horizon where it is", () => {
    const placements = autoplan(
      [
        row({
          id: "running",
          workOrderId: "W-R",
          startAt: at("2026-02-02T05:00"),
          endAt: at("2026-02-02T09:00"),
        }),
        row({ id: "next", workOrderId: "W-N" }),
      ],
      lanes,
      "FORWARD",
      horizon,
    );

    expect(local(placed(placements, "running").window.startAt)).toBe(
      local(at("2026-02-02T05:00")),
    );
    expect(local(placed(placements, "next").window.startAt)).toBe(
      local(at("2026-02-02T09:00")),
    );
  });

  it("releases a successor once the send-ahead count is produced", () => {
    const sendAhead = [
      row({ id: "op10", sequence: 10, resourceId: "r1", sendAheadQuantity: 5 }),
      row({
        id: "op20",
        sequence: 20,
        resourceId: "r2",
        rates: rates({ cycleSeconds: 360, leadTimeSeconds: 900 }),
      }),
    ];

    const placements = autoplan(sendAhead, lanes, "FORWARD", horizon);

    // Five of the ten pieces are 1 800 s of production from 06:00, so the
    // successor is released at 06:30 and waits its 900 s of lead time.
    expect(local(placed(placements, "op20").window.startAt)).toBe(
      local(at("2026-02-02T06:45")),
    );
    expect(local(placed(placements, "op20").window.endAt)).toBe(
      local(at("2026-02-02T07:45")),
    );
  });

  it("waits for the whole predecessor when no send-ahead is set", () => {
    const placements = autoplan(
      [
        row({ id: "op10", sequence: 10, resourceId: "r1" }),
        row({
          id: "op20",
          sequence: 20,
          resourceId: "r2",
          rates: rates({ cycleSeconds: 360, leadTimeSeconds: 900 }),
        }),
      ],
      lanes,
      "FORWARD",
      horizon,
    );

    expect(local(placed(placements, "op20").window.startAt)).toBe(
      local(at("2026-02-02T07:15")),
    );
  });

  it("skips a row with no lane", () => {
    const placements = autoplan(
      [
        row({ id: "placed", resourceId: "r1" }),
        row({ id: "backlog", workOrderId: "W-B", resourceId: null }),
        row({ id: "stranger", workOrderId: "W-S", resourceId: "r9" }),
      ],
      lanes,
      "BACKWARD",
      horizon,
    );

    expect(placements.map((placement) => placement.id)).toEqual(["placed"]);
  });
});
