// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Loading by time chunk (ADR 0089): a chunk is a fixed span of plant time aligned to plant dates,
// whose length follows the zoom level. Chunks do not move with the scroll, so a loaded chunk stays
// valid while the buffer moves over it.
import { Temporal } from 'temporal-polyfill';
import type { ZoomLevel } from '../gantt-data.ts';
import type { TimeRange } from './time-scale.ts';

/** The length of a chunk: an ISO week from Monday, a calendar month or a calendar quarter. */
export type ChunkUnit = 'isoWeek' | 'month' | 'quarter';

/** One chunk of plant time, [fromMs, toMs), with a key that names it: "2026-W45", "2026-11", "2026-Q4". */
export interface TimeChunk extends TimeRange {
  readonly key: string;
}

/** The working default of ADR 0089: an ISO week up to `week`, a month at `4weeks` and `quarter`, a quarter at `year`. */
export function chunkUnitOf(zoom: ZoomLevel): ChunkUnit {
  if (zoom === 'year') return 'quarter';
  if (zoom === '4weeks' || zoom === 'quarter') return 'month';
  return 'isoWeek';
}

/** The first plant date of the chunk that holds a plant date. */
function chunkStart(date: Temporal.PlainDate, unit: ChunkUnit): Temporal.PlainDate {
  if (unit === 'isoWeek') return date.subtract({ days: date.dayOfWeek - 1 });
  if (unit === 'month') return date.with({ day: 1 });
  return date.with({ month: date.month - ((date.month - 1) % 3), day: 1 });
}

function nextChunkStart(start: Temporal.PlainDate, unit: ChunkUnit): Temporal.PlainDate {
  if (unit === 'isoWeek') return start.add({ weeks: 1 });
  return start.add({ months: unit === 'month' ? 1 : 3 });
}

function chunkKey(start: Temporal.PlainDate, unit: ChunkUnit): string {
  if (unit === 'isoWeek') {
    const week = start.weekOfYear ?? 0;
    return `${start.yearOfWeek ?? start.year}-W${String(week).padStart(2, '0')}`;
  }
  if (unit === 'month') return start.toPlainYearMonth().toString();
  return `${start.year}-Q${Math.ceil(start.month / 3)}`;
}

const midnight = (date: Temporal.PlainDate, timeZone: string) =>
  date.toZonedDateTime({ timeZone }).epochMilliseconds;

function chunkAt(start: Temporal.PlainDate, unit: ChunkUnit, timeZone: string): TimeChunk {
  return {
    key: chunkKey(start, unit),
    fromMs: midnight(start, timeZone),
    toMs: midnight(nextChunkStart(start, unit), timeZone),
  };
}

/** The chunks of a level that a half-open range touches, in time order. */
export function chunksCovering(range: TimeRange, zoom: ZoomLevel, timeZone: string): TimeChunk[] {
  const unit = chunkUnitOf(zoom);
  const first = Temporal.Instant.fromEpochMilliseconds(range.fromMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
  const chunks: TimeChunk[] = [];
  let start = chunkStart(first, unit);
  for (;;) {
    const chunk = chunkAt(start, unit, timeZone);
    if (chunk.fromMs >= range.toMs) break;
    chunks.push(chunk);
    start = nextChunkStart(start, unit);
  }
  return chunks;
}

/** The chunk before the first or after the last of a list, one chunk ahead of the buffer. */
function neighbour(
  chunk: TimeChunk,
  direction: 'before' | 'after',
  zoom: ZoomLevel,
  timeZone: string,
): TimeChunk {
  const at = direction === 'before' ? chunk.fromMs - 1 : chunk.toMs;
  return chunksCovering({ fromMs: at, toMs: at + 1 }, zoom, timeZone)[0] ?? chunk;
}

/**
 * The chunks a view wants, in the order it loads them: the chunks in view, the rest of the
 * buffer, then the next chunk on each side ahead of time (ADR 0089).
 */
export function wantedChunks({
  view,
  buffer,
  zoom,
  timeZone,
}: {
  readonly view: TimeRange;
  readonly buffer: TimeRange;
  readonly zoom: ZoomLevel;
  readonly timeZone: string;
}): TimeChunk[] {
  const inBuffer = chunksCovering(buffer, zoom, timeZone);
  const inView = new Set(chunksCovering(view, zoom, timeZone).map((chunk) => chunk.key));
  const first = inBuffer[0];
  const last = inBuffer[inBuffer.length - 1];
  const ahead =
    first === undefined || last === undefined
      ? []
      : [neighbour(first, 'before', zoom, timeZone), neighbour(last, 'after', zoom, timeZone)];
  return [
    ...inBuffer.filter((chunk) => inView.has(chunk.key)),
    ...inBuffer.filter((chunk) => !inView.has(chunk.key)),
    ...ahead,
  ];
}

/** Whether a loaded chunk lies more than two buffer widths from the buffer, so the view drops it. */
export function isFarChunk(chunk: TimeRange, buffer: TimeRange): boolean {
  const reach = 2 * (buffer.toMs - buffer.fromMs);
  return chunk.fromMs > buffer.toMs + reach || chunk.toMs < buffer.fromMs - reach;
}
