// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDate, formatPlantTime } from '@northmes/contracts/format';
import { Temporal } from 'temporal-polyfill';
import type { ZoomPreset } from '../gantt-data.ts';

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

/** One zoom preset of the approved board design D3: its span, snap step and tick tiers. */
export interface ZoomPresetSpec {
  readonly id: ZoomPreset;
  readonly label: string;
  /** The span as whole days from the range start, or as hours for the Hours preset. */
  readonly span: { readonly days: number } | { readonly hours: number };
  /** Whether the range starts at the production day start or at midnight. */
  readonly startsAt: 'productionDay' | 'midnight';
  /** The snap step in milliseconds. */
  readonly stepMs: number;
  /** The top tier of the time header: one tick per day or per ISO week. */
  readonly topTier: 'day' | 'week';
  /** The bottom tier: a tick every so many hours, or one per day. */
  readonly bottomTier: { readonly hours: number } | 'day';
  /** The width of one hour at the preset's natural size, so the time area scrolls sideways. */
  readonly pxPerHour: number;
}

/** The four presets with the snap steps of plan 18 (Day 1 h, Week 4 h, 4 weeks 1 day, Hours 15 min). */
export const zoomPresets: Readonly<Record<ZoomPreset, ZoomPresetSpec>> = {
  hours: {
    id: 'hours',
    label: 'Hours',
    span: { hours: 12 },
    startsAt: 'productionDay',
    stepMs: 15 * 60_000,
    topTier: 'day',
    bottomTier: { hours: 1 },
    pxPerHour: 100,
  },
  day: {
    id: 'day',
    label: 'Day',
    span: { days: 3 },
    startsAt: 'productionDay',
    stepMs: hour,
    topTier: 'day',
    bottomTier: { hours: 3 },
    pxPerHour: 48,
  },
  week: {
    id: 'week',
    label: 'Week',
    span: { days: 7 },
    startsAt: 'midnight',
    stepMs: 4 * hour,
    topTier: 'day',
    bottomTier: { hours: 6 },
    pxPerHour: 16,
  },
  '4weeks': {
    id: '4weeks',
    label: '4 weeks',
    span: { days: 28 },
    startsAt: 'midnight',
    stepMs: day,
    topTier: 'week',
    bottomTier: 'day',
    pxPerHour: 3,
  },
};

/** The order of the presets in the toolbar, finest first. */
export const zoomPresetIds: readonly ZoomPreset[] = ['hours', 'day', 'week', '4weeks'];

/** A plant date, "2026-11-02", as the start of that day or of its production day in the zone. */
function startOfDate(date: string, timeZone: string, clock: string): Temporal.ZonedDateTime {
  const plain = Temporal.PlainDate.from(date);
  const [hours = 0, minutes = 0] = clock.split(':').map(Number);
  return plain.toZonedDateTime({ timeZone, plainTime: { hour: hours, minute: minutes } });
}

/**
 * The visible range of a preset from a plant date: Hours and Day from the production day start of
 * that date, Week from its midnight, 4 weeks from the Monday of its ISO week. Day steps are
 * wall-clock days, so a range across a clock change keeps its dates (ADR 0024).
 */
export function rangeOf(
  from: string,
  zoom: ZoomPreset,
  timeZone: string,
  productionDayStart: string,
): TimeRange {
  const preset = zoomPresets[zoom];
  let start = startOfDate(
    from,
    timeZone,
    preset.startsAt === 'midnight' ? '00:00' : productionDayStart,
  );
  if (zoom === '4weeks') start = start.subtract({ days: start.dayOfWeek - 1 });
  const end =
    'days' in preset.span
      ? start.add({ days: preset.span.days })
      : start.add({ hours: preset.span.hours });
  return { fromMs: start.epochMilliseconds, toMs: end.epochMilliseconds };
}

/**
 * The natural width of a range at a preset: its hours at the preset's pixels per hour, or, with
 * closed time hidden, its open hours plus a gap per closed window. The time area takes this width
 * when the view is narrower, and scrolls sideways inside its container (plan 18, Reflow).
 */
export function naturalWidthPx(
  range: TimeRange,
  zoom: ZoomPreset,
  hideClosed?: { readonly closed: readonly ClosedWindow[]; readonly gapPx?: number },
): number {
  const { pxPerHour } = zoomPresets[zoom];
  if (hideClosed === undefined) return ((range.toMs - range.fromMs) / hour) * pxPerHour;
  const windows = clippedWindows(hideClosed.closed, range);
  const closedMs = windows.reduce((sum, window) => sum + (window.toMs - window.fromMs), 0);
  return (
    ((range.toMs - range.fromMs - closedMs) / hour) * pxPerHour +
    windows.length * (hideClosed.gapPx ?? 6)
  );
}

/** The plant date one span earlier or later than `from` under a preset, for Earlier and Later. */
export function shiftedFrom(
  from: string,
  zoom: ZoomPreset,
  direction: 'earlier' | 'later',
): string {
  const preset = zoomPresets[zoom];
  const days = 'days' in preset.span ? preset.span.days : 1;
  const plain = Temporal.PlainDate.from(from);
  return (direction === 'earlier' ? plain.subtract({ days }) : plain.add({ days })).toString();
}

/**
 * The loaded range of a preset from a plant date, extended by whole spans before and after it
 * (#685): the view grows the margin on demand as the planner scrolls towards an edge, so the time
 * area never ends at the preset's span while `from` stays the chosen start.
 */
export function extendedRange(
  from: string,
  zoom: ZoomPreset,
  timeZone: string,
  productionDayStart: string,
  extension: { readonly before: number; readonly after: number },
): TimeRange {
  const preset = zoomPresets[zoom];
  // The Hours preset spans hours of one day, so its spans are added as hours; the other presets
  // step whole dates, as Earlier and Later do.
  if ('hours' in preset.span) {
    const chosen = rangeOf(from, zoom, timeZone, productionDayStart);
    const spanMs = preset.span.hours * hour;
    return {
      fromMs: chosen.fromMs - extension.before * spanMs,
      toMs: chosen.toMs + extension.after * spanMs,
    };
  }
  let first = from;
  for (let count = 0; count < extension.before; count += 1) {
    first = shiftedFrom(first, zoom, 'earlier');
  }
  let last = from;
  for (let count = 0; count < extension.after; count += 1) {
    last = shiftedFrom(last, zoom, 'later');
  }
  return {
    fromMs: rangeOf(first, zoom, timeZone, productionDayStart).fromMs,
    toMs: rangeOf(last, zoom, timeZone, productionDayStart).toMs,
  };
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
  readonly tier: 'top' | 'bottom';
}

export interface TimeScaleInput {
  readonly range: TimeRange;
  readonly zoom: ZoomPreset;
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
  readonly zoom: ZoomPreset;
  readonly timeZone: string;
  readonly widthPx: number;
  readonly stepMs: number;
  /** The compressed closed windows, none without hideClosed. */
  readonly gaps: readonly ScaleGap[];
  /** The x of an instant, in pixels from the range start; outside the range it runs on. */
  readonly x: (ms: number) => number;
  /** The instant at an x. */
  readonly instant: (x: number) => number;
  /** The instant snapped to the preset's step on the plant's wall clock, offset-preserving. */
  readonly snap: (ms: number) => number;
  /** The ticks of both tiers inside the range. */
  readonly ticks: () => readonly TimeTick[];
  /** Whether an instant lies in a compressed closed window. */
  readonly inGap: (ms: number) => boolean;
}

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
  timeZone,
  widthPx,
  productionDayStart,
  hideClosed,
}: TimeScaleInput): TimeScale {
  const preset = zoomPresets[zoom];
  const spanMs = range.toMs - range.fromMs;
  const gapPx = hideClosed?.gapPx ?? 6;
  const windows = hideClosed === undefined ? [] : clippedWindows(hideClosed.closed, range);
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
    if (preset.stepMs >= day) {
      return zoned.round({ smallestUnit: 'day', roundingMode: 'halfExpand' }).epochMilliseconds;
    }
    // Temporal rounds whole hours and minutes within the day in the zone, so a 4 h step lands on
    // 00:00, 04:00, 08:00 of the plant clock.
    const wholeHours = preset.stepMs % hour === 0;
    return zoned.round({
      smallestUnit: wholeHours ? 'hour' : 'minute',
      roundingIncrement: wholeHours ? preset.stepMs / hour : preset.stepMs / 60_000,
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

  /**
   * The start of the top cell that holds the range start: the Monday of its ISO week, or its plant
   * day from midnight or from the production day start, so a day cell names its own open time.
   */
  const firstTopStart = (): Temporal.ZonedDateTime => {
    const start = Temporal.Instant.fromEpochMilliseconds(range.fromMs).toZonedDateTimeISO(timeZone);
    if (preset.topTier === 'week')
      return start.subtract({ days: start.dayOfWeek - 1 }).startOfDay();
    const clock =
      preset.startsAt === 'midnight'
        ? '00:00'
        : (productionDayStart ?? start.toPlainTime().toString().slice(0, 5));
    const dayStart = start
      .toPlainDate()
      .toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from(clock) });
    return dayStart.epochMilliseconds > range.fromMs ? dayStart.subtract({ days: 1 }) : dayStart;
  };

  const ticks = (): TimeTick[] => {
    const top: TimeTick[] = [];
    // The top tier steps wall-clock days or weeks (ADR 0024).
    const topStep = preset.topTier === 'week' ? { weeks: 1 } : { days: 1 };
    for (let at = firstTopStart(); at.epochMilliseconds < range.toMs; ) {
      const next = at.add(topStep);
      const ms = at.epochMilliseconds;
      const cell = openCell(ms, next.epochMilliseconds);
      if (cell !== undefined) {
        // A week reads "W45, Mon 2 Nov" or "W45", a day "Mon 2 Nov" or its day of the month.
        const week = `W${at.weekOfYear ?? ''}`;
        const formats =
          preset.topTier === 'week'
            ? [`${week}, ${formatPlantDate(ms, timeZone)}`, week]
            : [formatPlantDate(ms, timeZone), String(at.day)];
        top.push({
          ms,
          x: cell.x,
          widthPx: cell.widthPx,
          label: fittingLabel(formats, cell.widthPx, 'top'),
          tier: 'top',
        });
      }
      at = next;
    }
    const topMs = new Set(top.map((tick) => tick.ms));
    const bottom: TimeTick[] = [];
    const pushBottom = (
      ms: number,
      toMs: number,
      formats: (openFromMs: number) => readonly string[],
    ) => {
      const cell = topMs.has(ms) ? undefined : openCell(ms, toMs);
      if (cell === undefined) return;
      bottom.push({
        ms,
        x: cell.x,
        widthPx: cell.widthPx,
        label: fittingLabel(formats(cell.openFromMs), cell.widthPx, 'bottom'),
        tier: 'bottom',
      });
    };
    const start = Temporal.Instant.fromEpochMilliseconds(range.fromMs).toZonedDateTimeISO(timeZone);
    if (preset.bottomTier === 'day') {
      for (let at = start; at.epochMilliseconds < range.toMs; at = at.add({ days: 1 })) {
        const ms = at.epochMilliseconds;
        const date = at.day;
        pushBottom(ms, at.add({ days: 1 }).epochMilliseconds, () => [
          formatPlantDate(ms, timeZone),
          String(date),
        ]);
      }
    } else {
      // Hour ticks come from exact instants, so a clock change gives 23 or 25 of them. A cell
      // clipped at its start is named by the clock where its open time starts, as its x is.
      const stepMs = preset.bottomTier.hours * hour;
      for (let ms = range.fromMs; ms < range.toMs; ms += stepMs) {
        pushBottom(ms, ms + stepMs, (openFromMs) => {
          // "06:00" shortens to "06" on the hour only; "06:30" has no short form.
          const clock = formatPlantTime(openFromMs, timeZone);
          return clock.endsWith(':00') ? [clock, clock.slice(0, -3)] : [clock];
        });
      }
    }
    return [...top, ...bottom];
  };

  return {
    range,
    zoom,
    timeZone,
    widthPx,
    stepMs: preset.stepMs,
    gaps,
    x,
    instant,
    snap,
    ticks,
    inGap,
  };
}

/** The range as the toolbar names it: "W45, Mon 2 Nov to Sun 8 Nov". */
export function rangeLabel(range: TimeRange, zoom: ZoomPreset, timeZone: string): string {
  const start = Temporal.Instant.fromEpochMilliseconds(range.fromMs).toZonedDateTimeISO(timeZone);
  // The last day is one wall-clock day before the range end: a Day range ends at the production
  // day start after its last day, so the instant before its end would name the day after.
  const end = Temporal.Instant.fromEpochMilliseconds(range.toMs).toZonedDateTimeISO(timeZone);
  const last = formatPlantDate(end.subtract({ days: 1 }).epochMilliseconds, timeZone);
  const first = formatPlantDate(range.fromMs, timeZone);
  if (zoom === 'hours') {
    return `${first}, ${formatPlantTime(range.fromMs, timeZone)} to ${formatPlantTime(range.toMs, timeZone)}`;
  }
  const week = zoom === 'week' || zoom === '4weeks' ? `W${start.weekOfYear ?? ''}, ` : '';
  return `${week}${first} to ${last}`;
}
