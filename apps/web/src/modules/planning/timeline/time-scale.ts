// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDate, formatPlantDateTime, formatPlantTime } from '@northmes/contracts/format';
import { Temporal } from 'temporal-polyfill';
import type { ZoomLevel, ZoomPreset } from '../gantt-data.ts';

/** A half-open span of time in epoch milliseconds, [fromMs, toMs). */
export interface TimeRange {
  readonly fromMs: number;
  readonly toMs: number;
}

/** A closed window of the calendar: a night, a break or a weekend, [fromMs, toMs). */
export interface ClosedWindow {
  readonly fromMs: number;
  readonly toMs: number;
}

const hour = 3_600_000;
const day = 86_400_000;

/** A unit of a header tier: a cell every so many minutes, hours, days, weeks, months or years. */
export interface TierUnit {
  readonly unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  readonly count: number;
}

/** The bucket kind of the workload lanes at a level (plan 18, The workload lane). */
export type BucketKind = 'shift' | 'productionDay' | 'isoWeek' | 'month';

/**
 * One level of the zoom ladder (ADR 0089, Zoom levels): its chosen span, its header tiers, its
 * natural width, its snap step and its workload bucket.
 */
export interface ZoomLevelSpec {
  readonly id: ZoomLevel;
  readonly label: string;
  /** The span from the range start, in hours, whole days or whole months. */
  readonly span:
    | { readonly hours: number }
    | { readonly days: number }
    | { readonly months: number };
  /**
   * Where the range of a plant date starts: at its production day start, at its midnight, at the
   * Monday of its ISO week or at the first of its month.
   */
  readonly startsAt: 'productionDay' | 'midnight' | 'isoWeek' | 'month';
  /** The snap step in milliseconds. */
  readonly stepMs: number;
  /** The top tier of the time header. */
  readonly topTier: TierUnit;
  /** The bottom tier of the time header. */
  readonly bottomTier: TierUnit;
  /** The width of one hour at the level's natural size, so the time area scrolls sideways. */
  readonly pxPerHour: number;
  /** The bucket of the workload lanes at the level. */
  readonly bucket: BucketKind;
  /**
   * Whether plan 18's rules for Hours and Day zoom apply (the deadline's time label, the wait and
   * free float lines), or else its rules for Week and 4 weeks (the shift strip's working days, the
   * 2 px rule for hollow segments).
   */
  readonly fine: boolean;
}

const tier = (unit: TierUnit['unit'], count = 1): TierUnit => ({ unit, count });

/**
 * The ladder of ADR 0089 with D3's four presets under their ids, and the snap steps of plan 18
 * (Hours 15 min, Day 1 h, Week 4 h, 4 weeks 1 day). Each level is two to five times coarser than
 * the one before it, and each natural width holds the long label of its bottom tier.
 */
export const zoomLevels: Readonly<Record<ZoomLevel, ZoomLevelSpec>> = {
  'quarter-hours': {
    id: 'quarter-hours',
    label: 'Quarter hours',
    span: { hours: 6 },
    startsAt: 'productionDay',
    stepMs: 5 * 60_000,
    topTier: tier('hour'),
    bottomTier: tier('minute', 15),
    pxPerHour: 240,
    bucket: 'shift',
    fine: true,
  },
  hours: {
    id: 'hours',
    label: 'Hours',
    span: { hours: 12 },
    startsAt: 'productionDay',
    stepMs: 15 * 60_000,
    topTier: tier('day'),
    bottomTier: tier('hour'),
    pxPerHour: 100,
    bucket: 'shift',
    fine: true,
  },
  day: {
    id: 'day',
    label: 'Day',
    span: { days: 3 },
    startsAt: 'productionDay',
    stepMs: hour,
    topTier: tier('day'),
    bottomTier: tier('hour', 3),
    pxPerHour: 48,
    bucket: 'shift',
    fine: true,
  },
  week: {
    id: 'week',
    label: 'Week',
    span: { days: 7 },
    startsAt: 'midnight',
    stepMs: 4 * hour,
    topTier: tier('day'),
    bottomTier: tier('hour', 6),
    pxPerHour: 16,
    bucket: 'productionDay',
    fine: false,
  },
  '4weeks': {
    id: '4weeks',
    label: '4 weeks',
    span: { days: 28 },
    startsAt: 'isoWeek',
    stepMs: day,
    topTier: tier('week'),
    bottomTier: tier('day'),
    pxPerHour: 3,
    bucket: 'isoWeek',
    fine: false,
  },
  quarter: {
    id: 'quarter',
    label: 'Quarter',
    span: { months: 3 },
    startsAt: 'month',
    stepMs: day,
    topTier: tier('month'),
    bottomTier: tier('week'),
    pxPerHour: 0.6,
    bucket: 'isoWeek',
    fine: false,
  },
  year: {
    id: 'year',
    label: 'Year',
    span: { months: 12 },
    startsAt: 'month',
    stepMs: day,
    topTier: tier('year'),
    bottomTier: tier('month'),
    pxPerHour: 0.15,
    bucket: 'month',
    fine: false,
  },
};

/** The levels of the ladder, finest first. */
export const zoomLevelIds = [
  'quarter-hours',
  'hours',
  'day',
  'week',
  '4weeks',
  'quarter',
  'year',
] as const;

/** The four presets of D3 in the job order table's Range group, finest first. */
export const zoomPresetIds: readonly ZoomPreset[] = ['hours', 'day', 'week', '4weeks'];

/**
 * The zoom of the board and the Gantt (ADR 0090, Zoom as a width per hour): the width of one hour,
 * and the band of the ladder it is drawn in, which sets the header tiers, the snap step, the
 * workload bucket and the chunk length. A level id stands for its natural width in that band.
 */
export interface Zoom {
  readonly band: ZoomLevel;
  readonly pxPerHour: number;
}

/** A zoom, or a level id at its natural width. */
export type ZoomLike = Zoom | ZoomLevel;

/** The zoom a level id stands for. */
export function zoomOf(zoom: ZoomLike): Zoom {
  return typeof zoom === 'string' ? { band: zoom, pxPerHour: zoomLevels[zoom].pxPerHour } : zoom;
}

/** The widths the zoom keeps within: the natural widths of Year and Quarter hours. */
export const zoomClamp = {
  min: zoomLevels.year.pxPerHour,
  max: zoomLevels['quarter-hours'].pxPerHour,
} as const;

/** A width per hour within the clamp. */
export function clampZoom(pxPerHour: number): number {
  return Math.min(zoomClamp.max, Math.max(zoomClamp.min, pxPerHour));
}

/**
 * The lower edge of each band but the coarsest, finest first: the geometric mean of its natural
 * width and the next coarser level's, so Day covers about 27.7 to 69.3 px per hour.
 */
const bandFloors = zoomLevelIds.slice(0, -1).map((id, index) => {
  const coarser = zoomLevelIds[index + 1] as ZoomLevel;
  return Math.sqrt(zoomLevels[id].pxPerHour * zoomLevels[coarser].pxPerHour);
});

/** The band a width lies in by the edges alone, as at the end of a gesture and in a URL. */
export function bandOf(pxPerHour: number): ZoomLevel {
  const index = bandFloors.findIndex((floor) => pxPerHour >= floor);
  return zoomLevelIds[index === -1 ? zoomLevelIds.length - 1 : index] as ZoomLevel;
}

/** How far past a band edge a gesture goes before the band changes (ADR 0090). */
const hysteresis = 1.1;

/**
 * The band during a gesture or an animation: the band it is in stays until the width is more than
 * a factor of 1.1 past one of its edges, so a gesture that hovers at an edge does not swap tiers
 * and snap steps back and forth.
 */
export function bandDuringGesture(pxPerHour: number, band: ZoomLevel): ZoomLevel {
  const index = zoomLevelIds.indexOf(band);
  const floor = bandFloors[index] ?? 0;
  const ceiling = index === 0 ? Number.POSITIVE_INFINITY : (bandFloors[index - 1] as number);
  if (pxPerHour * hysteresis >= floor && pxPerHour <= ceiling * hysteresis) return band;
  return bandOf(pxPerHour);
}

/** A width to three significant digits, as the URL holds it (ADR 0090, The URL key zoom). */
export function roundZoom(pxPerHour: number): number {
  return Number(pxPerHour.toPrecision(3));
}

/** Whether plan 18's rules for Hours and Day zoom apply: at `day` and every finer level (ADR 0089). */
export function isFineLevel(level: ZoomLevel): boolean {
  return zoomLevels[level].fine;
}

/** Whether plan 18's rules for Week and 4 weeks zoom apply: at `week` and every coarser level. */
export function isCoarseLevel(level: ZoomLevel): boolean {
  return !zoomLevels[level].fine;
}

/**
 * The preset of the job order table's Range nearest a level: Quarter hours opens at Hours, and
 * Quarter and Year at 4 weeks (ADR 0089, Krister, 2026-10-30).
 */
export function presetOfLevel(level: ZoomLevel): ZoomPreset {
  if (level === 'quarter-hours') return 'hours';
  if (level === 'quarter' || level === 'year') return '4weeks';
  return level;
}

/** A plant date, "2026-11-02", as the start of that day or of its production day in the zone. */
function startOfDate(date: string, timeZone: string, clock: string): Temporal.ZonedDateTime {
  const plain = Temporal.PlainDate.from(date);
  const [hours = 0, minutes = 0] = clock.split(':').map(Number);
  return plain.toZonedDateTime({ timeZone, plainTime: { hour: hours, minute: minutes } });
}

/**
 * The visible range of a level from a plant date: Quarter hours, Hours and Day from the production
 * day start of that date, Week from its midnight, 4 weeks from the Monday of its ISO week, Quarter
 * and Year from the first of its month. Day and month steps are wall-clock steps, so a range
 * across a clock change keeps its dates (ADR 0024).
 */
export function rangeOf(
  from: string,
  zoom: ZoomLevel,
  timeZone: string,
  productionDayStart: string,
): TimeRange {
  const level = zoomLevels[zoom];
  const plain = Temporal.PlainDate.from(from);
  const date =
    level.startsAt === 'isoWeek'
      ? plain.subtract({ days: plain.dayOfWeek - 1 })
      : level.startsAt === 'month'
        ? plain.with({ day: 1 })
        : plain;
  const start = startOfDate(
    date.toString(),
    timeZone,
    level.startsAt === 'productionDay' ? productionDayStart : '00:00',
  );
  return { fromMs: start.epochMilliseconds, toMs: start.add(level.span).epochMilliseconds };
}

/**
 * The natural width of a range at a zoom: its hours at the zoom's pixels per hour, or, with
 * closed time hidden, its open hours plus a gap per closed window. The time area takes this width
 * when the view is narrower, and scrolls sideways inside its container (plan 18, Reflow).
 */
export function naturalWidthPx(
  range: TimeRange,
  zoom: ZoomLike,
  hideClosed?: { readonly closed: readonly ClosedWindow[]; readonly gapPx?: number },
): number {
  const { pxPerHour } = zoomOf(zoom);
  if (hideClosed === undefined) return ((range.toMs - range.fromMs) / hour) * pxPerHour;
  const windows = compressedWindows(hideClosed.closed, range, pxPerHour, hideClosed.gapPx ?? 6);
  const closedMs = windows.reduce((sum, window) => sum + (window.toMs - window.fromMs), 0);
  return (
    ((range.toMs - range.fromMs - closedMs) / hour) * pxPerHour +
    windows.length * (hideClosed.gapPx ?? 6)
  );
}

/**
 * The plant date one span earlier or later than `from` under a level, for Earlier and Later: whole
 * days or months, and a day for the levels that span hours of one day.
 */
export function shiftedFrom(from: string, zoom: ZoomLevel, direction: 'earlier' | 'later'): string {
  const { span } = zoomLevels[zoom];
  const step = 'hours' in span ? { days: 1 } : span;
  const plain = Temporal.PlainDate.from(from);
  return (direction === 'earlier' ? plain.subtract(step) : plain.add(step)).toString();
}

/** The plant date of an instant, for the `from` of a range around it. */
export function plantDateOf(epochMs: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
}

/**
 * One cell of a time header tier. With closed time hidden the cell is clipped to the open time it
 * holds (ADR 0089, Header tiers): it starts at its first open segment and ends at its last.
 */
export interface TimeTick {
  /** The instant the cell starts at on the plant clock, before clipping. */
  readonly ms: number;
  /** The x of the cell's first open segment, where its label starts. */
  readonly x: number;
  /** The width from x to the end of the cell's last open segment. */
  readonly widthPx: number;
  readonly label: string;
  /** The cell's full date, and its clock on an hour cell, whichever label fits (#902). */
  readonly name: string;
  readonly tier: 'top' | 'bottom';
}

export interface TimeScaleInput {
  readonly range: TimeRange;
  /** The band, whose tiers and snap step the scale takes. */
  readonly zoom: ZoomLevel;
  /**
   * The width of an hour, which decides the closed windows Hide closed time compresses; the
   * band's natural width without it. The scale itself spreads the range over `widthPx`.
   */
  readonly pxPerHour?: number;
  readonly timeZone: string;
  readonly widthPx: number;
  /**
   * The plant's production day start, "06:00", where the day cells of Hours and Day begin. Without
   * it they begin at the range start's clock, which an Hours range extended by 12 h spans moves.
   */
  readonly productionDayStart?: string;
  /**
   * Hide closed time: every closed window of the calendar inside the range is drawn as a gap of a
   * few pixels, so the open time takes the width. A local option; ADR 0030 cut the compressed axis
   * from release 1 and the amendment that takes it back is named in the pull request.
   */
  readonly hideClosed?: {
    readonly closed: readonly ClosedWindow[];
    /** The width of each gap; 6 px as the D5 frames draw it. */
    readonly gapPx?: number;
  };
}

/** A compressed closed window: where it lies on the axis. */
export interface ScaleGap extends ClosedWindow {
  readonly x: number;
  readonly widthPx: number;
}

/** The time scale of a screen: every position goes through it (ADR 0030). */
export interface TimeScale {
  readonly range: TimeRange;
  /** The band the scale is drawn in. */
  readonly zoom: ZoomLevel;
  /** The width of an hour the scale was laid out at. */
  readonly pxPerHour: number;
  readonly timeZone: string;
  readonly widthPx: number;
  readonly stepMs: number;
  /** The compressed closed windows, none without hideClosed. */
  readonly gaps: readonly ScaleGap[];
  /** The x of an instant, in pixels from the range start; outside the range it runs on. */
  readonly x: (ms: number) => number;
  /** The instant at an x. */
  readonly instant: (x: number) => number;
  /** The instant snapped to the level's step on the plant's wall clock, offset-preserving. */
  readonly snap: (ms: number) => number;
  /** The ticks of both tiers inside the range. */
  readonly ticks: () => readonly TimeTick[];
  /** Whether an instant lies in a compressed closed window. */
  readonly inGap: (ms: number) => boolean;
}

/** The width of the gap a compressed closed window becomes, 6 px as the D5 frames draw it. */
export const gapPx = 6;

/** The closed windows clipped to the range, sorted and merged where they touch or overlap. */
function clippedWindows(closed: readonly ClosedWindow[], range: TimeRange): ClosedWindow[] {
  const sorted = closed
    .map((window) => ({
      fromMs: Math.max(window.fromMs, range.fromMs),
      toMs: Math.min(window.toMs, range.toMs),
    }))
    .filter((window) => window.toMs > window.fromMs)
    .sort((a, b) => a.fromMs - b.fromMs);
  const merged: ClosedWindow[] = [];
  for (const window of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && window.fromMs <= last.toMs) {
      merged[merged.length - 1] = { fromMs: last.fromMs, toMs: Math.max(last.toMs, window.toMs) };
    } else {
      merged.push(window);
    }
  }
  return merged;
}

/**
 * The closed windows that Hide closed time compresses: those whose width at the current zoom is
 * wider than the gap they become, so the axis never widens at a coarse zoom, where a night is a
 * few pixels (ADR 0089, Header tiers; ADR 0090).
 */
export function compressedWindows(
  closed: readonly ClosedWindow[],
  range: TimeRange,
  pxPerHour: number,
  gapPx: number,
): ClosedWindow[] {
  return clippedWindows(closed, range).filter(
    (window) => ((window.toMs - window.fromMs) / hour) * pxPerHour > gapPx,
  );
}

/**
 * The width a label takes in its tier, from the header's type: the top tier is 12 px IBM Plex Sans
 * with 6 px padding each side, the bottom tier 11 px IBM Plex Mono (6.6 px a character) with 4 px,
 * and each has a 1 px start border. Each character counts a little wider than the font draws it,
 * so a label that fits never spills into the next cell, also in a fallback font.
 */
const labelType = {
  top: { charPx: 7.5, paddingPx: 13 },
  bottom: { charPx: 7, paddingPx: 9 },
} as const;

/** The first of a cell's label formats, longest first, that fits its width, or none. */
function fittingLabel(formats: readonly string[], widthPx: number, tier: 'top' | 'bottom'): string {
  const { charPx, paddingPx } = labelType[tier];
  return formats.find((format) => format.length * charPx + paddingPx <= widthPx) ?? '';
}

/** The months of the plant calendar in the header's language. */
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** A plant month, "2026-11", as the header names it: "November 2026". */
export function formatMonth(yearMonth: string): string {
  const month = Temporal.PlainYearMonth.from(yearMonth);
  return `${monthNames[month.month - 1] ?? ''} ${month.year}`;
}

/** A clock label and its short form: "06:00" shortens to "06" on the hour only. */
function clockFormats(clock: string): readonly string[] {
  return clock.endsWith(':00') ? [clock, clock.slice(0, -3)] : [clock];
}

/** An anchor of the piecewise linear axis: an instant and its x. */
interface Anchor {
  readonly ms: number;
  readonly x: number;
}

/** The index of the last anchor at or before a value, by binary search over `key`. */
function lastAtOrBefore(anchors: readonly Anchor[], value: number, key: keyof Anchor): number {
  let low = 0;
  let high = anchors.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    const anchor = anchors[mid];
    if (anchor !== undefined && anchor[key] <= value) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function createTimeScale({
  range,
  zoom,
  pxPerHour = zoomLevels[zoom].pxPerHour,
  timeZone,
  widthPx,
  productionDayStart,
  hideClosed,
}: TimeScaleInput): TimeScale {
  const level = zoomLevels[zoom];
  const spanMs = range.toMs - range.fromMs;
  const gapPx = hideClosed?.gapPx ?? 6;
  const windows =
    hideClosed === undefined ? [] : compressedWindows(hideClosed.closed, range, pxPerHour, gapPx);
  const closedMs = windows.reduce((sum, window) => sum + (window.toMs - window.fromMs), 0);
  const openMs = spanMs - closedMs;
  const openWidth = Math.max(0, widthPx - windows.length * gapPx);
  // Pixels per millisecond of open time; the plain axis has no gaps, so it is width over span.
  const pxPerMs = openMs > 0 ? openWidth / openMs : 0;

  // The anchors at each window's start and end, so x and instant walk one segment each.
  const anchors: Anchor[] = [{ ms: range.fromMs, x: 0 }];
  const gaps: ScaleGap[] = [];
  let cursorMs = range.fromMs;
  let cursorX = 0;
  for (const window of windows) {
    cursorX += (window.fromMs - cursorMs) * pxPerMs;
    anchors.push({ ms: window.fromMs, x: cursorX });
    gaps.push({ ...window, x: cursorX, widthPx: gapPx });
    cursorX += gapPx;
    cursorMs = window.toMs;
    anchors.push({ ms: window.toMs, x: cursorX });
  }
  const endX = cursorX + (range.toMs - cursorMs) * pxPerMs;
  anchors.push({ ms: range.toMs, x: endX });

  const x = (ms: number): number => {
    const index = lastAtOrBefore(anchors, ms, 'ms');
    const anchor = anchors[index] as Anchor;
    const next = anchors[index + 1];
    const gap = gaps.find((each) => each.fromMs === anchor.ms);
    if (next !== undefined && gap !== undefined && ms < next.ms) {
      // Inside a compressed window: spread the gap's pixels over it.
      return anchor.x + ((ms - anchor.ms) / (next.ms - anchor.ms)) * gap.widthPx;
    }
    return anchor.x + (ms - anchor.ms) * pxPerMs;
  };

  const instant = (px: number): number => {
    const index = lastAtOrBefore(anchors, px, 'x');
    const anchor = anchors[index] as Anchor;
    const next = anchors[index + 1];
    const gap = gaps.find((each) => each.fromMs === anchor.ms);
    if (next !== undefined && gap !== undefined && px < next.x) {
      return anchor.ms + ((px - anchor.x) / gap.widthPx) * (next.ms - anchor.ms);
    }
    return pxPerMs === 0 ? anchor.ms : anchor.ms + (px - anchor.x) / pxPerMs;
  };

  const inGap = (ms: number): boolean => gaps.some((gap) => ms > gap.fromMs && ms < gap.toMs);

  const snap = (ms: number): number => {
    const zoned = Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZone);
    if (level.stepMs >= day) {
      return zoned.round({ smallestUnit: 'day', roundingMode: 'halfExpand' }).epochMilliseconds;
    }
    // Temporal rounds whole hours and minutes within the day in the zone, so a 4 h step lands on
    // 00:00, 04:00, 08:00 of the plant clock.
    const wholeHours = level.stepMs % hour === 0;
    return zoned.round({
      smallestUnit: wholeHours ? 'hour' : 'minute',
      roundingIncrement: wholeHours ? level.stepMs / hour : level.stepMs / 60_000,
      roundingMode: 'halfExpand',
    }).epochMilliseconds;
  };

  /**
   * A cell of [fromMs, toMs) clipped to the range and to its open time: from the end of a gap it
   * starts in to the start of a gap it ends in. The windows are merged, so one gap at most covers
   * either edge. A cell wholly inside a gap has no open time and gives none.
   */
  const openCell = (fromMs: number, toMs: number) => {
    const startMs = Math.max(fromMs, range.fromMs);
    const endMs = Math.min(toMs, range.toMs);
    const openFrom =
      gaps.find((gap) => gap.fromMs <= startMs && startMs < gap.toMs)?.toMs ?? startMs;
    const openTo = gaps.find((gap) => gap.fromMs < endMs && endMs <= gap.toMs)?.fromMs ?? endMs;
    if (openTo <= openFrom) return undefined;
    return { openFromMs: openFrom, x: x(openFrom), widthPx: x(openTo) - x(openFrom) };
  };

  /** The instant of the range start on the plant clock. */
  const rangeStart = () =>
    Temporal.Instant.fromEpochMilliseconds(range.fromMs).toZonedDateTimeISO(timeZone);

  /**
   * The start of the calendar cell of a unit that holds the range start: its hour, its year, the
   * first of its month, the Monday of its ISO week, or its day from midnight. A top day cell starts
   * at the production day start at the levels whose range does, so a day names its own open time.
   */
  const cellStart = (unit: TierUnit['unit'], productionDay: boolean): Temporal.ZonedDateTime => {
    const start = rangeStart();
    if (unit === 'minute' || unit === 'hour') {
      return start.round({ smallestUnit: 'hour', roundingMode: 'floor' });
    }
    if (unit === 'year') return start.with({ month: 1, day: 1 }).startOfDay();
    if (unit === 'month') return start.with({ day: 1 }).startOfDay();
    if (unit === 'week') return start.subtract({ days: start.dayOfWeek - 1 }).startOfDay();
    if (!productionDay) return start.startOfDay();
    const clock = productionDayStart ?? start.toPlainTime().toString().slice(0, 5);
    const dayStart = start
      .toPlainDate()
      .toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from(clock) });
    return dayStart.epochMilliseconds > range.fromMs ? dayStart.subtract({ days: 1 }) : dayStart;
  };

  /** The step of a calendar cell: wall-clock days, weeks, months and years (ADR 0024). */
  const cellStep = ({ unit, count }: TierUnit): Temporal.DurationLike => ({ [`${unit}s`]: count });

  /**
   * The label formats of a calendar cell, longest first, and its full name (#902). A day reads
   * "Mon 2 Nov" or its day of the month, a week "W45, Mon 2 Nov" or "W45", a month "November
   * 2026" in the top tier and "November" in the bottom one, and an hour of the top tier
   * "Wed 4 Nov, 06:00" or its clock, from where its open time starts (`openFromMs`), as a clock
   * cell of the bottom tier is named.
   */
  const cellText = (
    unit: TierUnit['unit'],
    at: Temporal.ZonedDateTime,
    topTier: boolean,
    openFromMs: number,
  ): { readonly formats: readonly string[]; readonly name: string } => {
    if (unit === 'year') return { formats: [String(at.year)], name: String(at.year) };
    if (unit === 'month') {
      const name = formatMonth(at.toPlainDate().toPlainYearMonth().toString());
      const [long = '', year = ''] = name.split(' ');
      const short = long.slice(0, 3);
      return { formats: topTier ? [name, `${short} ${year}`, short] : [long, short], name };
    }
    const date = formatPlantDate(at.epochMilliseconds, timeZone);
    if (unit === 'week') {
      const week = `W${at.weekOfYear ?? ''}`;
      return { formats: [`${week}, ${date}`, week], name: `Week ${at.weekOfYear ?? ''}, ${date}` };
    }
    if (unit === 'day') return { formats: [date, String(at.day)], name: date };
    const ms = openFromMs;
    const clock = formatPlantTime(ms, timeZone);
    return {
      formats: [`${formatPlantDate(ms, timeZone)}, ${clock}`, ...clockFormats(clock)],
      name: formatPlantDateTime(ms, timeZone),
    };
  };

  const ticks = (): TimeTick[] => {
    const top: TimeTick[] = [];
    const topUnit = level.topTier.unit;
    for (
      let at = cellStart(topUnit, level.startsAt === 'productionDay');
      at.epochMilliseconds < range.toMs;
    ) {
      const next = at.add(cellStep(level.topTier));
      const ms = at.epochMilliseconds;
      const cell = openCell(ms, next.epochMilliseconds);
      if (cell !== undefined) {
        const { formats, name } = cellText(topUnit, at, true, cell.openFromMs);
        top.push({
          ms,
          x: cell.x,
          widthPx: cell.widthPx,
          label: fittingLabel(formats, cell.widthPx, 'top'),
          name,
          tier: 'top',
        });
      }
      at = next;
    }
    // A bottom cell that starts with a top cell goes without a tick where the top cell names it:
    // the day over its first hours, the ISO week over its Monday, the hour over its first quarter.
    // A month does not name its first week, nor a year its January, so those keep their cells.
    const { unit: bottomUnit, count } = level.bottomTier;
    const namedByTop = bottomUnit !== 'week' && bottomUnit !== 'month';
    const topMs = new Set(namedByTop ? top.map((tick) => tick.ms) : []);
    const bottom: TimeTick[] = [];
    const pushBottom = (
      ms: number,
      toMs: number,
      formats: (openFromMs: number) => readonly string[],
      name: (openFromMs: number) => string,
    ) => {
      const cell = topMs.has(ms) ? undefined : openCell(ms, toMs);
      if (cell === undefined) return;
      bottom.push({
        ms,
        x: cell.x,
        widthPx: cell.widthPx,
        label: fittingLabel(formats(cell.openFromMs), cell.widthPx, 'bottom'),
        name: name(cell.openFromMs),
        tier: 'bottom',
      });
    };
    if (bottomUnit === 'minute' || bottomUnit === 'hour') {
      // Clock ticks come from exact instants, so a clock change gives 23 or 25 hours. A cell
      // clipped at its start is named by the clock where its open time starts, as its x is.
      const stepMs = count * (bottomUnit === 'hour' ? hour : 60_000);
      // The cells keep to the plant clock wherever the range starts, as a buffer of the endless
      // axis starts anywhere (ADR 0089): each starts on the wall clock, every step from the day's
      // start at the level (midnight or the production day start), so on a day of 23 or 25 hours
      // the cell that holds the clock change is an hour shorter or longer and the next one is on
      // the clock again. A wall-clock start in the spring gap is the first instant after it.
      const start = rangeStart();
      const clock = Temporal.PlainTime.from(
        level.startsAt === 'productionDay'
          ? (productionDayStart ?? start.toPlainTime().toString().slice(0, 5))
          : '00:00',
      );
      let day = start.toPlainDate();
      if (day.toZonedDateTime({ timeZone, plainTime: clock }).epochMilliseconds > range.fromMs) {
        day = day.subtract({ days: 1 });
      }
      const stepMinutes = stepMs / 60_000;
      const at = (minutes: number) =>
        day
          .toPlainDateTime(clock)
          .add({ minutes })
          .toZonedDateTime(timeZone, { disambiguation: 'compatible' }).epochMilliseconds;
      let previousMs = Number.NEGATIVE_INFINITY;
      for (let minutes = 0; ; minutes += stepMinutes) {
        const ms = at(minutes);
        if (ms >= range.toMs) break;
        const nextMs = at(minutes + stepMinutes);
        if (ms > previousMs && nextMs > range.fromMs) {
          pushBottom(
            ms,
            nextMs,
            (openFromMs) => {
              const clock = formatPlantTime(openFromMs, timeZone);
              // A quarter hour also reads as its minutes alone, "15", where the cell is narrower
              // than "06:15", at the coarse end of the Quarter hours band (ADR 0090).
              return bottomUnit === 'minute'
                ? [...clockFormats(clock), clock.slice(3)]
                : clockFormats(clock);
            },
            (openFromMs) => formatPlantDateTime(openFromMs, timeZone),
          );
        }
        previousMs = ms;
      }
    } else {
      for (let at = cellStart(bottomUnit, false); at.epochMilliseconds < range.toMs; ) {
        const next = at.add(cellStep(level.bottomTier));
        const { formats, name } = cellText(bottomUnit, at, false, at.epochMilliseconds);
        pushBottom(
          at.epochMilliseconds,
          next.epochMilliseconds,
          () => formats,
          () => name,
        );
        at = next;
      }
    }
    return [...top, ...bottom];
  };

  return {
    range,
    zoom,
    pxPerHour,
    timeZone,
    widthPx,
    stepMs: level.stepMs,
    gaps,
    x,
    instant,
    snap,
    ticks,
    inGap,
  };
}

/**
 * The range as the toolbar names it: "W45, Mon 2 Nov to Sun 8 Nov", "Wed 4 Nov, 06:00 to 18:00" at
 * the levels that span hours, and "November 2026 to January 2027" at the levels that span months.
 */
export function rangeLabel(range: TimeRange, zoom: ZoomLevel, timeZone: string): string {
  const { span } = zoomLevels[zoom];
  const start = Temporal.Instant.fromEpochMilliseconds(range.fromMs).toZonedDateTimeISO(timeZone);
  // The last day is one wall-clock day before the range end: a Day range ends at the production
  // day start after its last day, so the instant before its end would name the day after.
  const end = Temporal.Instant.fromEpochMilliseconds(range.toMs).toZonedDateTimeISO(timeZone);
  const lastDay = end.subtract({ days: 1 });
  const first = formatPlantDate(range.fromMs, timeZone);
  if ('hours' in span) {
    return `${first}, ${formatPlantTime(range.fromMs, timeZone)} to ${formatPlantTime(range.toMs, timeZone)}`;
  }
  if ('months' in span) {
    const month = (at: Temporal.ZonedDateTime) =>
      formatMonth(at.toPlainDate().toPlainYearMonth().toString());
    return `${month(start)} to ${month(lastDay)}`;
  }
  const last = formatPlantDate(lastDay.epochMilliseconds, timeZone);
  const week = zoom === 'week' || zoom === '4weeks' ? `W${start.weekOfYear ?? ''}, ` : '';
  return `${week}${first} to ${last}`;
}

/**
 * The span in view as the toolbar names it while the planner scrolls (ADR 0089, The endless axis):
 * "W45, Mon 2 Nov to Thu 5 Nov" at Week and 4 weeks, "Wed 4 Nov to Sat 7 Nov" at Day, "Wed 4 Nov,
 * 06:00 to 18:00" at the levels that span hours ("Wed 4 Nov 20:20 to Thu 5 Nov 08:20" across
 * midnight), and "November 2026 to February 2027" at the levels that span months. The last day is
 * the day of the span's last instant, so a span that ends at midnight ends on the day before.
 */
export function spanLabel(span: TimeRange, zoom: ZoomLevel, timeZone: string): string {
  const level = zoomLevels[zoom];
  const lastMs = Math.max(span.fromMs, span.toMs - 1);
  const zoned = (ms: number) =>
    Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZone);
  const first = formatPlantDate(span.fromMs, timeZone);
  const last = formatPlantDate(lastMs, timeZone);
  if ('hours' in level.span) {
    const from = formatPlantTime(span.fromMs, timeZone);
    const to = formatPlantTime(span.toMs, timeZone);
    if (first === formatPlantDate(span.toMs, timeZone) || first === last) {
      return `${first}, ${from} to ${to}`;
    }
    return `${first} ${from} to ${formatPlantDate(span.toMs, timeZone)} ${to}`;
  }
  if ('months' in level.span) {
    const month = (ms: number) =>
      formatMonth(zoned(ms).toPlainDate().toPlainYearMonth().toString());
    return `${month(span.fromMs)} to ${month(lastMs)}`;
  }
  const week =
    zoom === 'week' || zoom === '4weeks' ? `W${zoned(span.fromMs).weekOfYear ?? ''}, ` : '';
  return `${week}${first} to ${last}`;
}
