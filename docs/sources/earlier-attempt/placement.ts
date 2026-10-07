import type { PlanningDirection } from "@mes/contracts";
import { DateTime } from "luxon";
import {
  type BucketRule,
  type CalendarRule,
  type ExceptionRule,
  openSpansOn as openSpansOfDay,
} from "./calendar-rules.js";

/*
 * Placement (order management plan, O-6): how long an operation takes on a
 * machine and where it lands on the calendar, as pure functions. The
 * service reads the row, the machine, its calendar version and exceptions
 * and hands them in; nothing here touches Prisma, the clock, or another
 * service, so a spec can put a worked example, short sample rows and both
 * daylight-saving nights through the same code the board runs.
 *
 * The arithmetic: cycles are the quantity over parts per cycle;
 * production seconds are cycles times the effective cycle seconds
 * over the target OEE (as a fraction), plus the fixed term; setup precedes
 * production and may begin at the lead time's end minus its own length. All
 * of it is stretched across the calendar: only open windows (capacity above
 * zero, an exception winning over the buckets) count, so a job crossing a
 * weekend ends later, never faster.
 */

/** The operation's rates as the release froze them, after the machine's override. */
export interface PlacementRates {
  /** Seconds per cycle on this machine (the override's, else the operation's). */
  readonly cycleSeconds: number;
  readonly partsPerCycle: number;
  readonly setupSeconds: number;
  /** 0 to 100; 100 when the operation names none. */
  readonly targetOeePercent: number;
  /** Seconds that do not scale with quantity. */
  readonly fixedSeconds: number;
  /** Waiting time after the predecessor before production may start. */
  readonly leadTimeSeconds: number;
}

/** The machine's calendar as the rules read it: the version in force and its exceptions. */
export interface PlacementCalendar {
  readonly calendar: CalendarRule;
  readonly buckets: readonly BucketRule[];
  readonly exceptions: readonly ExceptionRule[];
}

/** Either when production may start, or when it must be done. */
export type PlacementAnchor =
  | { readonly startAt: DateTime; readonly endAt?: undefined }
  | { readonly endAt: DateTime; readonly startAt?: undefined };

/** What an estimate answers. */
export interface PlacementWindow {
  readonly setupSeconds: number;
  readonly productionSeconds: number;
  /** Null when the setup takes no time. */
  readonly setupStartAt: DateTime | null;
  readonly startAt: DateTime;
  readonly endAt: DateTime;
  /** Wall time from setup start (or start) to end. */
  readonly elapsedSeconds: number;
  /** How much of the wall time fell in closed windows. */
  readonly closedSeconds: number;
}

/**
 * How far a walk looks for open time before it gives up. A calendar with no
 * buckets and a default of zero never opens, and a plan that asked it for an
 * end would otherwise loop; a year and a day is well past any horizon a
 * board draws.
 */
const MAX_WALK_DAYS = 366;

/** One stretch of open time, as instants. Half open: the end is not open. */
interface OpenSpan {
  readonly start: DateTime;
  readonly end: DateTime;
}

/**
 * The open stretches of one calendar day, as `openSpansOn` in the calendar
 * rules cuts them: every window edge, each piece judged by `capacityAt`, so
 * a break bucket, an exception and the default all land the same way here
 * as in `openSecondsOn`.
 */
function openSpansOn(calendar: PlacementCalendar, isoDate: string): OpenSpan[] {
  return openSpansOfDay(
    calendar.calendar,
    calendar.buckets,
    calendar.exceptions,
    isoDate,
  ).map((span) => ({ start: span.startsAt, end: span.endsAt }));
}

const secondsBetween = (start: DateTime, end: DateTime): number =>
  end.diff(start, "seconds").seconds;

/** The open stretches from an instant onwards, day by day, earliest first. */
function* openSpansFrom(
  calendar: PlacementCalendar,
  from: DateTime,
): Generator<OpenSpan> {
  const zone = calendar.calendar.timeZone;
  let day = from.setZone(zone).startOf("day");

  for (let index = 0; index <= MAX_WALK_DAYS; index += 1) {
    const isoDate = day.toISODate();
    if (isoDate !== null) {
      for (const span of openSpansOn(calendar, isoDate)) {
        if (span.end > from) {
          yield { start: span.start < from ? from : span.start, end: span.end };
        }
      }
    }
    day = day.plus({ days: 1 });
  }
}

/** The open stretches before an instant, day by day, latest first. */
function* openSpansBefore(
  calendar: PlacementCalendar,
  until: DateTime,
): Generator<OpenSpan> {
  const zone = calendar.calendar.timeZone;
  let day = until.setZone(zone).startOf("day");

  for (let index = 0; index <= MAX_WALK_DAYS; index += 1) {
    const isoDate = day.toISODate();
    if (isoDate !== null) {
      for (const span of openSpansOn(calendar, isoDate).toReversed()) {
        if (span.start < until) {
          yield { start: span.start, end: span.end > until ? until : span.end };
        }
      }
    }
    day = day.minus({ days: 1 });
  }
}

function tooLittleOpenTime(
  calendar: PlacementCalendar,
  anchor: DateTime,
  seconds: number,
  found: number,
): never {
  const zone = calendar.calendar.timeZone;
  const at = anchor.toISO() ?? "an unreadable instant";

  throw new Error(
    found === 0
      ? `Calendar ${zone} has no open time within ${MAX_WALK_DAYS} days of ${at}.`
      : `Calendar ${zone} has ${found} open seconds within ${MAX_WALK_DAYS} days of ${at}, and ${seconds} were asked for.`,
  );
}

/**
 * Cycles times the effective cycle over the target OEE, plus the fixed term.
 * The pure arithmetic, with no calendar: 7 200 pieces at 45 s, three per
 * cycle, at OEE 75 percent are 144 000 seconds (TC1 of NorthMES ADR 0027).
 */
export function productionSeconds(
  rates: PlacementRates,
  quantity: number,
): number {
  const partsPerCycle = rates.partsPerCycle > 0 ? rates.partsPerCycle : 1;
  const oee = rates.targetOeePercent > 0 ? rates.targetOeePercent / 100 : 1;
  const cycles = Math.max(quantity, 0) / partsPerCycle;

  return Math.round((cycles * rates.cycleSeconds) / oee + rates.fixedSeconds);
}

/**
 * Stretch a duration across the calendar from an instant forward: the end
 * is the instant at which `seconds` of open time have elapsed. A start
 * inside a closed window moves to the next opening first. Backward does the
 * mirror image from an end.
 */
export function advance(
  calendar: PlacementCalendar,
  from: DateTime,
  seconds: number,
  direction: PlanningDirection,
): DateTime {
  let remaining = Math.max(seconds, 0);
  let found = 0;
  const spans =
    direction === "FORWARD"
      ? openSpansFrom(calendar, from)
      : openSpansBefore(calendar, from);

  for (const span of spans) {
    const length = secondsBetween(span.start, span.end);
    if (remaining <= length) {
      return direction === "FORWARD"
        ? span.start.plus({ seconds: remaining })
        : span.end.minus({ seconds: remaining });
    }
    remaining -= length;
    found += length;
  }

  return tooLittleOpenTime(calendar, from, seconds, found);
}

/** The open seconds inside a window, for the closed share of a placement. */
function openSecondsBetween(
  calendar: PlacementCalendar,
  from: DateTime,
  to: DateTime,
): number {
  if (to <= from) {
    return 0;
  }

  let total = 0;
  for (const span of openSpansFrom(calendar, from)) {
    if (span.start >= to) {
      break;
    }
    total += secondsBetween(span.start, span.end > to ? to : span.end);
  }

  return total;
}

function windowOf(
  setupSeconds: number,
  production: number,
  setupStartAt: DateTime | null,
  startAt: DateTime,
  endAt: DateTime,
  calendar: PlacementCalendar,
): PlacementWindow {
  const from = setupStartAt ?? startAt;
  const elapsedSeconds = secondsBetween(from, endAt);

  return {
    setupSeconds,
    productionSeconds: production,
    setupStartAt,
    startAt,
    endAt,
    elapsedSeconds,
    closedSeconds: elapsedSeconds - openSecondsBetween(calendar, from, endAt),
  };
}

/**
 * Estimate one row on one machine: the setup window then the production
 * window, from the anchor forward or back from it, both on open time only.
 * With `earliestStartAt` (the predecessor's end plus the lead time), a
 * forward placement never starts production before it, and setup may begin
 * up to its own length before it.
 */
export function estimate(
  rates: PlacementRates,
  quantity: number,
  anchor: PlacementAnchor,
  calendar: PlacementCalendar,
  earliestStartAt?: DateTime | null,
): PlacementWindow {
  const production = productionSeconds(rates, quantity);
  const setup = Math.max(rates.setupSeconds, 0);

  if (anchor.startAt === undefined) {
    // Backward. The anchor is a deadline, so the earliest start says
    // nothing here: a backward placement answers where the work has to sit
    // to be done in time, and the caller compares that with the release.
    const endAt = advance(calendar, anchor.endAt, 0, "BACKWARD");
    const startAt = advance(calendar, endAt, production, "BACKWARD");
    const setupStartAt =
      setup > 0 ? advance(calendar, startAt, setup, "BACKWARD") : null;

    return windowOf(setup, production, setupStartAt, startAt, endAt, calendar);
  }

  const opening = advance(calendar, anchor.startAt, 0, "FORWARD");
  const afterSetup = advance(calendar, opening, setup, "FORWARD");

  if (earliestStartAt != null && afterSetup < earliestStartAt) {
    // The machine is free before the material is. Production waits for the
    // release and the setup is measured back from it, so the machine is
    // ready the moment the pieces arrive.
    const startAt = advance(calendar, earliestStartAt, 0, "FORWARD");
    const setupStartAt =
      setup > 0 ? advance(calendar, startAt, setup, "BACKWARD") : null;
    const endAt = advance(calendar, startAt, production, "FORWARD");

    return windowOf(setup, production, setupStartAt, startAt, endAt, calendar);
  }

  const setupStartAt = setup > 0 ? opening : null;
  const endAt = advance(calendar, afterSetup, production, "FORWARD");

  return windowOf(setup, production, setupStartAt, afterSetup, endAt, calendar);
}

/** One row the autoplan places or leaves where it is. */
export interface AutoplanRow {
  readonly id: string;
  readonly workOrderId: string;
  /** The routing sequence; a lower one on the same order is a predecessor. */
  readonly sequence: number;
  readonly quantity: number;
  readonly priority: number;
  /** The deadline a backward plan works from; null falls back to the horizon end. */
  readonly dueAt: DateTime | null;
  readonly pinned: boolean;
  /** The lane the row sits on, or is seeded with; null rows are skipped. */
  readonly resourceId: string | null;
  readonly rates: PlacementRates;
  /** Pieces of the predecessor that release this row early; null means all. */
  readonly sendAheadQuantity: number | null;
  /** Kept as they are on a pinned or started row. */
  readonly startAt: DateTime | null;
  readonly endAt: DateTime | null;
}

export interface AutoplanLane {
  readonly resourceId: string;
  readonly calendar: PlacementCalendar;
}

export interface AutoplanPlacement {
  readonly id: string;
  readonly resourceId: string;
  readonly window: PlacementWindow;
  readonly sequenceIndex: number;
}

/** A row on a lane, from the first minute of setup to the last of production. */
interface Busy {
  readonly start: DateTime;
  readonly end: DateTime;
}

const blockStartOf = (window: PlacementWindow): DateTime =>
  window.setupStartAt ?? window.startAt;

const busyOf = (window: PlacementWindow): Busy => ({
  start: blockStartOf(window),
  end: window.endAt,
});

const overlaps = (block: Busy, other: Busy): boolean =>
  block.start < other.end && other.start < block.end;

/**
 * A row keeps its window when a planner pinned it, and when it started
 * before the horizon began: the first is a decision, the second is a fact on
 * the floor. Both need a window to keep, so a row with no instants on it is
 * movable whatever its flag says.
 */
function isFrozen(
  row: AutoplanRow,
  horizon: { readonly startAt: DateTime },
): row is AutoplanRow & { startAt: DateTime; endAt: DateTime } {
  return (
    row.startAt !== null &&
    row.endAt !== null &&
    (row.pinned || row.startAt < horizon.startAt)
  );
}

/** The window a frozen row already has: its setup runs at the front of it. */
function keptWindow(
  row: AutoplanRow & { startAt: DateTime; endAt: DateTime },
  lane: AutoplanLane,
): PlacementWindow {
  const setup = Math.max(row.rates.setupSeconds, 0);
  const setupStartAt = setup > 0 ? row.startAt : null;
  const startAt =
    setup > 0
      ? advance(lane.calendar, row.startAt, setup, "FORWARD")
      : row.startAt;

  return windowOf(
    setup,
    productionSeconds(row.rates, row.quantity),
    setupStartAt,
    startAt,
    row.endAt,
    lane.calendar,
  );
}

/**
 * Place a row as late as the deadline allows, then as late as the lane
 * allows: each clash pushes the end back to the start of the row it ran
 * into, so the walk only ever moves earlier and stops after one pass per
 * row already on the lane.
 */
function fitBackward(
  row: AutoplanRow,
  lane: AutoplanLane,
  busy: readonly Busy[],
  deadline: DateTime,
): PlacementWindow {
  let endAt = deadline;
  let window = estimate(row.rates, row.quantity, { endAt }, lane.calendar);

  for (let attempt = 0; attempt < busy.length; attempt += 1) {
    const clash = busy
      .filter((other) => overlaps(busyOf(window), other))
      .toSorted((a, b) => a.start.toMillis() - b.start.toMillis())[0];
    if (clash === undefined) {
      break;
    }
    endAt = clash.start;
    window = estimate(row.rates, row.quantity, { endAt }, lane.calendar);
  }

  return window;
}

/** The mirror image: each clash pushes the start to the end of the row it met. */
function fitForward(
  row: AutoplanRow,
  lane: AutoplanLane,
  busy: readonly Busy[],
  from: DateTime,
  earliestStartAt: DateTime | null,
): PlacementWindow {
  let startAt = from;
  let window = estimate(
    row.rates,
    row.quantity,
    { startAt },
    lane.calendar,
    earliestStartAt,
  );

  for (let attempt = 0; attempt < busy.length; attempt += 1) {
    const clash = busy
      .filter((other) => overlaps(busyOf(window), other))
      .toSorted((a, b) => b.end.toMillis() - a.end.toMillis())[0];
    if (clash === undefined) {
      break;
    }
    startAt = clash.end;
    window = estimate(
      row.rates,
      row.quantity,
      { startAt },
      lane.calendar,
      earliestStartAt,
    );
  }

  return window;
}

/**
 * The instant a predecessor releases its successor: the end of its
 * production, or, when it sends a count ahead, the instant those pieces are
 * finished. The pieces are made on the predecessor's own machine, so the
 * count is stretched across that lane's calendar.
 */
function releaseOf(
  row: AutoplanRow,
  lane: AutoplanLane,
  window: PlacementWindow,
): DateTime {
  const sendAhead = row.sendAheadQuantity;
  if (sendAhead === null || sendAhead <= 0 || sendAhead >= row.quantity) {
    return window.endAt;
  }

  return advance(
    lane.calendar,
    window.startAt,
    productionSeconds(row.rates, sendAhead),
    "FORWARD",
  );
}

/** How much production is left after the send-ahead count has been made. */
function tailSeconds(row: AutoplanRow): number {
  const sendAhead = row.sendAheadQuantity;
  if (sendAhead === null || sendAhead <= 0 || sendAhead >= row.quantity) {
    return 0;
  }

  return Math.max(
    productionSeconds(row.rates, row.quantity) -
      productionSeconds(row.rates, sendAhead),
    0,
  );
}

const earliestMillis = (rows: readonly AutoplanRow[]): number => {
  const dates = rows
    .map((row) => row.dueAt)
    .filter((dueAt): dueAt is DateTime => dueAt !== null);

  return dates.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...dates.map((dueAt) => dueAt.toMillis()));
};

/**
 * Place every movable row on its lane, one after the other, never
 * overlapping another row on the same lane, never before the predecessor's
 * end (or the instant its send-ahead count is reached) plus the lead time,
 * ties broken by the lower priority value then the earlier due date.
 * Backward works from each row's deadline towards today; forward from the
 * horizon start. Pinned rows and rows with a start in the past keep their
 * windows and the others flow around them.
 */
export function autoplan(
  rows: readonly AutoplanRow[],
  lanes: readonly AutoplanLane[],
  direction: PlanningDirection,
  horizon: { readonly startAt: DateTime; readonly endAt: DateTime },
): AutoplanPlacement[] {
  const laneByResource = new Map(lanes.map((lane) => [lane.resourceId, lane]));
  const laneOf = (row: AutoplanRow): AutoplanLane | undefined =>
    row.resourceId === null ? undefined : laneByResource.get(row.resourceId);

  const busyByLane = new Map<string, Busy[]>();
  const placedWindows = new Map<string, PlacementWindow>();
  const placed: {
    row: AutoplanRow;
    lane: AutoplanLane;
    window: PlacementWindow;
  }[] = [];

  const record = (
    row: AutoplanRow,
    lane: AutoplanLane,
    window: PlacementWindow,
  ) => {
    const busy = busyByLane.get(lane.resourceId) ?? [];
    busy.push(busyOf(window));
    busyByLane.set(lane.resourceId, busy);
    placedWindows.set(row.id, window);
    placed.push({ row, lane, window });
  };

  const onLanes = rows.filter((row) => laneOf(row) !== undefined);

  for (const row of onLanes) {
    const lane = laneOf(row);
    if (lane !== undefined && isFrozen(row, horizon)) {
      record(row, lane, keptWindow(row, lane));
    }
  }

  const movable = onLanes.filter((row) => !isFrozen(row, horizon));
  const groups = new Map<string, AutoplanRow[]>();
  for (const row of movable) {
    groups.set(row.workOrderId, [...(groups.get(row.workOrderId) ?? []), row]);
  }

  // Whole orders compete, not single rows: the lower priority value takes
  // the slot it wants, then the earlier due date, then the id so two equal
  // orders land the same way every run.
  const ordered = [...groups.entries()].toSorted(
    ([leftId, left], [rightId, right]) => {
      const priority =
        Math.min(...left.map((row) => row.priority)) -
        Math.min(...right.map((row) => row.priority));
      if (priority !== 0) {
        return priority;
      }
      const due = earliestMillis(left) - earliestMillis(right);

      return due !== 0 ? due : leftId.localeCompare(rightId);
    },
  );

  for (const [, group] of ordered) {
    const inOrder = group.toSorted((left, right) =>
      direction === "BACKWARD"
        ? right.sequence - left.sequence
        : left.sequence - right.sequence,
    );

    for (const row of inOrder) {
      const lane = laneOf(row);
      if (lane === undefined) {
        continue;
      }
      const busy = busyByLane.get(lane.resourceId) ?? [];

      if (direction === "BACKWARD") {
        const successor = group
          .filter(
            (other) =>
              other.sequence > row.sequence && placedWindows.has(other.id),
          )
          .toSorted((left, right) => left.sequence - right.sequence)[0];
        const dueAt = row.dueAt ?? horizon.endAt;
        let deadline = dueAt < horizon.endAt ? dueAt : horizon.endAt;

        if (successor !== undefined) {
          const successorWindow = placedWindows.get(successor.id);
          if (successorWindow !== undefined) {
            // The successor's production may start once this row has
            // released it and the lead time has passed; what this row still
            // owes after the send-ahead count may run on past that instant.
            const release = successorWindow.startAt.minus({
              seconds: Math.max(successor.rates.leadTimeSeconds, 0),
            });
            const tail = tailSeconds(row);
            const limit =
              tail > 0
                ? advance(lane.calendar, release, tail, "FORWARD")
                : release;
            deadline = limit < deadline ? limit : deadline;
          }
        }

        record(row, lane, fitBackward(row, lane, busy, deadline));
        continue;
      }

      const predecessor = group
        .filter(
          (other) =>
            other.sequence < row.sequence && placedWindows.has(other.id),
        )
        .toSorted((left, right) => right.sequence - left.sequence)[0];
      let earliestStartAt: DateTime | null = null;

      if (predecessor !== undefined) {
        const predecessorWindow = placedWindows.get(predecessor.id);
        const predecessorLane = laneOf(predecessor);
        if (predecessorWindow !== undefined && predecessorLane !== undefined) {
          earliestStartAt = releaseOf(
            predecessor,
            predecessorLane,
            predecessorWindow,
          ).plus({ seconds: Math.max(row.rates.leadTimeSeconds, 0) });
        }
      }

      record(
        row,
        lane,
        fitForward(row, lane, busy, horizon.startAt, earliestStartAt),
      );
    }
  }

  // The index is the lane's own running order, so a board can read a row's
  // place on the machine without sorting the list again.
  const indexById = new Map<string, number>();
  for (const lane of lanes) {
    const onLane = placed
      .filter((entry) => entry.lane.resourceId === lane.resourceId)
      .toSorted(
        (left, right) =>
          blockStartOf(left.window).toMillis() -
          blockStartOf(right.window).toMillis(),
      );
    for (const [index, entry] of onLane.entries()) {
      indexById.set(entry.row.id, index);
    }
  }

  return placed
    .map(({ row, lane, window }) => ({
      id: row.id,
      resourceId: lane.resourceId,
      window,
      sequenceIndex: indexById.get(row.id) ?? 0,
    }))
    .toSorted(
      (left, right) =>
        left.resourceId.localeCompare(right.resourceId) ||
        left.sequenceIndex - right.sequenceIndex,
    );
}
