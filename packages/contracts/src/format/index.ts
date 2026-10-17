// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The pure formatters of plant time and durations (ADR 0061, plan 06 "Presentation settings"): the
// web, the server and later reports print the same strings. Every Intl call of the workspace lives
// in this folder; everything else takes a formatted string from here.

/**
 * The pinned base locale (ADR 0061): Gregorian calendar, Latin digits, and the en-GB order of day
 * before month, never the process or browser default, so a time reads the same on every host.
 */
export const pinnedLocale = 'en-GB-u-ca-gregory-nu-latn';

/** The parts a plant-time formatter prints: the date, the clock, or both. */
type PlantTimeParts = 'date' | 'time' | 'dateTime';

export interface PlantTimeOptions {
  /**
   * Adds the short zone name, such as CET: a screen asks for it when the browser zone differs from
   * the plant zone (ADR 0061), so a planner elsewhere knows the clock is the plant's.
   */
  readonly zoneLabel?: boolean;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** One Intl formatter per zone, parts and zone label, kept because constructing one is slow. */
function formatter(timeZone: string, parts: PlantTimeParts, zoneLabel: boolean) {
  const key = `${timeZone}|${parts}|${zoneLabel ? 'zone' : ''}`;
  const existing = formatters.get(key);
  if (existing !== undefined) return existing;
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    ...(parts !== 'time' && { weekday: 'short', day: 'numeric', month: 'short' }),
    ...(parts !== 'date' && { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    ...(zoneLabel && { timeZoneName: 'short' }),
  };
  const created = new Intl.DateTimeFormat(pinnedLocale, options);
  formatters.set(key, created);
  return created;
}

/**
 * The parts assembled by kind, so the locale's own punctuation, such as the comma en-GB puts
 * between the date and the clock, never reaches the screen: "Tue 3 Nov 11:30 CET".
 */
function assemble(formatted: Intl.DateTimeFormat, epochMs: number): string {
  const values = new Map<string, string>();
  for (const part of formatted.formatToParts(epochMs)) {
    if (part.type !== 'literal') values.set(part.type, part.value);
  }
  const date = [values.get('weekday'), values.get('day'), values.get('month')].filter(
    (part) => part !== undefined,
  );
  const clock =
    values.has('hour') && values.has('minute')
      ? `${values.get('hour')}:${values.get('minute')}`
      : '';
  return [date.join(' '), clock, values.get('timeZoneName') ?? '']
    .filter((part) => part !== '')
    .join(' ');
}

/** An instant as the plant's weekday, day, month and clock: "Tue 3 Nov 11:30". */
export function formatPlantDateTime(
  epochMs: number,
  timeZone: string,
  { zoneLabel = false }: PlantTimeOptions = {},
): string {
  return assemble(formatter(timeZone, 'dateTime', zoneLabel), epochMs);
}

/** An instant as the plant's weekday, day and month: "Fri 6 Nov". */
export function formatPlantDate(epochMs: number, timeZone: string): string {
  return assemble(formatter(timeZone, 'date', false), epochMs);
}

/** An instant as the plant's clock: "11:30". */
export function formatPlantTime(
  epochMs: number,
  timeZone: string,
  { zoneLabel = false }: PlantTimeOptions = {},
): string {
  return assemble(formatter(timeZone, 'time', zoneLabel), epochMs);
}

/** A plant date, "2026-11-05", as its weekday, day and month: "Thu 5 Nov". */
export function formatPlantDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return isoDate;
  return formatPlantDate(Date.UTC(year, month - 1, day), 'UTC');
}

/** Two instants as a span in plant time: "Tue 3 Nov 11:30 to Thu 5 Nov 10:45". */
export function formatSpan(fromMs: number, toMs: number, timeZone: string): string {
  return `${formatPlantDateTime(fromMs, timeZone)} to ${formatPlantDateTime(toMs, timeZone)}`;
}

export interface DurationOptions {
  /**
   * How hours above a day print: `days` as "1 day 4 h 15 min" (the default, for slack, late-by,
   * wait and float), `hours` as "28 h 15 min" (the elapsed and working time of a block, plan 18).
   */
  readonly form?: 'days' | 'hours';
  /** The units as words, "45 minutes", for a sentence such as a link's relation text. */
  readonly style?: 'short' | 'long';
}

/** The unit words of a duration part, short and long, singular and plural. */
const units = {
  day: { short: 'day', long: 'day', longPlural: 'days' },
  hour: { short: 'h', long: 'hour', longPlural: 'hours' },
  minute: { short: 'min', long: 'minute', longPlural: 'minutes' },
  second: { short: 's', long: 'second', longPlural: 'seconds' },
} as const;

/**
 * A number of seconds in words with a unit per part, never a bare number: "15 h 15 min",
 * "1 day 4 h 15 min", "4 h 9 min 40 s", "0 min". A negative duration starts with "minus", as the
 * total float of a row past its latest start does (plan 18).
 */
export function formatDuration(
  seconds: number,
  { form = 'days', style = 'short' }: DurationOptions = {},
): string {
  const whole = Math.round(Math.abs(seconds));
  const part = (count: number, unit: keyof typeof units) => {
    const word =
      style === 'short'
        ? unit === 'day'
          ? count === 1
            ? units.day.short
            : units.day.longPlural
          : units[unit].short
        : count === 1
          ? units[unit].long
          : units[unit].longPlural;
    return `${count} ${word}`;
  };
  if (whole === 0) return part(0, 'minute');
  const parts: string[] = [];
  let rest = whole;
  if (form === 'days' && rest >= 86_400) {
    const days = Math.floor(rest / 86_400);
    parts.push(part(days, 'day'));
    rest -= days * 86_400;
  }
  if (rest >= 3600) {
    parts.push(part(Math.floor(rest / 3600), 'hour'));
    rest %= 3600;
  }
  if (rest >= 60) {
    parts.push(part(Math.floor(rest / 60), 'minute'));
    rest %= 60;
  }
  if (rest > 0) parts.push(part(rest, 'second'));
  return `${seconds < 0 ? 'minus ' : ''}${parts.join(' ')}`;
}
