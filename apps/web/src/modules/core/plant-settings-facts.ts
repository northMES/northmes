// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime, formatPlantDay } from '@northmes/contracts/format';
import { Temporal } from 'temporal-polyfill';
import type {
  PlantCalendar,
  PlantCalendarDeviation,
  PlantMachine,
  PlantRouting,
  PlantSettingsSnapshot,
  PlantShift,
} from './plant-settings-data.ts';

/** The facts of the plant's machines and calendars that the plant settings pages share. */

/** The machine's name by its code, or the code where the snapshot does not name it. */
export function machineNamer(snapshot: PlantSettingsSnapshot): (code: string) => string {
  const names = new Map(snapshot.equipment.map((machine) => [machine.code, machine.name]));
  return (code) => names.get(code) ?? code;
}

/** The group's name by its code. */
export function groupNamer(snapshot: PlantSettingsSnapshot): (code: string) => string {
  const names = new Map(snapshot.equipmentGroups.map((group) => [group.code, group.name]));
  return (code) => names.get(code) ?? code;
}

/** The group's color token, such as palette-3, or none. */
export function groupColorOf(
  snapshot: PlantSettingsSnapshot,
  machine: PlantMachine,
): string | undefined {
  return snapshot.equipmentGroups.find((group) => group.code === machine.group)?.color;
}

/** One routing operation that names a machine among its allowed machines. */
export interface AllowedOperation {
  readonly routing: PlantRouting;
  readonly sequence: number;
  readonly name: string;
  /** The other machines the operation allows, by code. */
  readonly others: readonly string[];
}

/** The routing operations that may run on a machine, in routing and sequence order. */
export function allowedIn(snapshot: PlantSettingsSnapshot, code: string): AllowedOperation[] {
  return snapshot.routings.flatMap((routing) =>
    routing.operations
      .filter((operation) => operation.allowedEquipment.includes(code))
      .map((operation) => ({
        routing,
        sequence: operation.sequence,
        name: operation.name,
        others: operation.allowedEquipment.filter((each) => each !== code),
      })),
  );
}

/** "3 operations", "1 operation" or "No operations". */
export function allowedInText(count: number): string {
  if (count === 0) return 'No operations';
  return count === 1 ? '1 operation' : `${count} operations`;
}

/** The order numbers of the open orders of an article, each once. */
export function openOrdersOf(snapshot: PlantSettingsSnapshot, article: string): string[] {
  return [
    ...new Set(
      snapshot.jobOrders.filter((row) => row.article === article).map((row) => row.orderNumber),
    ),
  ];
}

const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The weekday's name, Monday for 1. */
export function weekdayName(isoWeekday: number): string {
  return weekdayNames[isoWeekday - 1] ?? String(isoWeekday);
}

/** "Mon to Fri", "Mon, Wed, Fri" or "Mon": the days a shift starts on. */
function daysText(weekdays: readonly number[]): string {
  const days = [...weekdays].sort((a, b) => a - b);
  const first = days[0];
  const last = days[days.length - 1];
  const short = (day: number) => weekdayName(day).slice(0, 3);
  // A span only for consecutive days: Mon, Wed and Fri must not read as Mon to Fri.
  const consecutive = first !== undefined && last !== undefined && last - first + 1 === days.length;
  if (first === undefined || last === undefined) return 'No working days';
  if (first === last) return short(first);
  return consecutive ? `${short(first)} to ${short(last)}` : days.map(short).join(', ');
}

/** The calendar's shifts each as "Mon to Fri Early 06:00 to 14:00"; one shift goes without its name. */
function shiftParts(
  calendar: PlantCalendar,
): { readonly shift: PlantShift; readonly text: string }[] {
  const named = calendar.shifts.length > 1;
  return calendar.shifts.map((shift) => ({
    shift,
    text: `${daysText(shift.weekdays)} ${named ? `${shift.name} ` : ''}${shift.start} to ${shift.end}`,
  }));
}

/**
 * "Mon to Fri 06:00 to 15:00", or with several shifts "Mon to Fri Early 06:00 to 14:00, Mon to Thu
 * Night 22:00 to 06:00": the days and times of each shift.
 */
export function shiftText(calendar: PlantCalendar): string {
  if (calendar.shifts.length === 0) return 'No shifts';
  return shiftParts(calendar)
    .map(({ text }) => text)
    .join(', ');
}

/** The plant date of a plant-local instant, "2026-11-07T06:00" to "2026-11-07". */
function dateOf(local: string): string {
  return local.slice(0, 10);
}

/** Whether a deviation covers any part of a plant date: it starts before the next day and ends after this one starts. */
function onDate(deviation: PlantCalendarDeviation, date: string): boolean {
  const end = deviation.endsLocal;
  const endsAfterStart = dateOf(end) > date || (dateOf(end) === date && end.slice(11) !== '00:00');
  return dateOf(deviation.startsLocal) <= date && endsAfterStart;
}

/** What one plant day of a calendar holds for a machine, or for all machines. */
export interface CalendarDayView {
  /** A shift starts on the day and the pattern applies. */
  readonly working: boolean;
  /** The overtime deviations that apply. */
  readonly overtime: readonly PlantCalendarDeviation[];
  /** The non-working deviation that closes the day for the machine, or for the plant. */
  readonly closed?: PlantCalendarDeviation;
  /** With all machines: the machines' own non-working deviations, which close no other machine. */
  readonly machineClosures: readonly PlantCalendarDeviation[];
}

/** Whether any shift of the calendar starts on the weekday. */
function startsOn(calendar: PlantCalendar, weekday: number): boolean {
  return calendar.shifts.some((shift) => shift.weekdays.includes(weekday));
}

/**
 * One plant day of a calendar (ADR 0025, rule 7): precedence goes by scope first, then by kind.
 * The plant's day is the shift minus its breaks, plus plant-wide overtime, minus plant-wide
 * non-working time; a machine's day is the plant's day plus its own overtime, minus its own
 * non-working time. So a plant holiday keeps a machine's overtime, and a machine's closed day
 * closes no other machine. With all machines the view shows the plant's day and every machine's
 * own deviations beside it.
 */
export function calendarDay(
  calendar: PlantCalendar,
  date: string,
  weekday: number,
  machine: string | undefined,
): CalendarDayView {
  const today = calendar.deviations.filter((deviation) => onDate(deviation, date));
  const plantWide = today.filter((deviation) => deviation.equipment === undefined);
  const scoped = today.filter((deviation) => deviation.equipment !== undefined);
  const plantClosed = plantWide.find((deviation) => deviation.kind === 'nonWorking');
  const plantOvertime = plantWide.filter((deviation) => deviation.kind === 'overtime');
  if (machine === undefined) {
    return {
      working: plantClosed === undefined && startsOn(calendar, weekday),
      overtime: [
        ...(plantClosed === undefined ? plantOvertime : []),
        ...scoped.filter((deviation) => deviation.kind === 'overtime'),
      ],
      ...(plantClosed !== undefined && { closed: plantClosed }),
      machineClosures: scoped.filter((deviation) => deviation.kind === 'nonWorking'),
    };
  }
  const own = scoped.filter((deviation) => deviation.equipment?.includes(machine));
  const machineClosed = own.find((deviation) => deviation.kind === 'nonWorking');
  const closed = machineClosed ?? plantClosed;
  return {
    working: closed === undefined && startsOn(calendar, weekday),
    overtime:
      machineClosed !== undefined
        ? []
        : [
            ...(plantClosed === undefined ? plantOvertime : []),
            ...own.filter((deviation) => deviation.kind === 'overtime'),
          ],
    ...(closed !== undefined && { closed }),
    machineClosures: [],
  };
}

/** "breaks 08:30 to 08:45 and 11:00 to 11:30", or "no breaks". */
function breaksText(shift: PlantShift): string {
  const spans = shift.breaks.map((each) => `${each.start} to ${each.end}`);
  if (spans.length === 0) return 'no breaks';
  if (spans.length === 1) return `break ${spans[0]}`;
  return `breaks ${spans.slice(0, -1).join(', ')} and ${spans[spans.length - 1]}`;
}

/**
 * "Mon to Fri 06:00 to 15:00, breaks 08:30 to 08:45 and 11:00 to 11:30": each shift with its
 * breaks, the shifts apart by semicolons.
 */
export function patternText(calendar: PlantCalendar): string {
  return shiftParts(calendar)
    .map(({ shift, text }) => `${text}, ${breaksText(shift)}`)
    .join('; ');
}

/** The working seconds of one cycle of the pattern: each shift on every day it starts on. */
export function weeklyWorkingSeconds(calendar: PlantCalendar): number {
  return calendar.shifts.reduce(
    (sum, shift) => sum + shift.weekdays.length * shift.workingSeconds,
    0,
  );
}

/** "41 h 15 min": a working time in hours form. */
export function hoursText(seconds: number): string {
  return formatDuration(seconds, { form: 'hours' });
}

/** A week of the plant: its Monday as a plant date and its ISO week number. */
export interface PlantWeek {
  /** The Monday, "2026-11-02". */
  readonly monday: string;
  readonly week: number;
  /** "W45, Mon 2 Nov to Sun 8 Nov". */
  readonly label: string;
  /** The Monday 00:00 and the next Monday 00:00 in the plant zone, as epoch milliseconds. */
  readonly fromMs: number;
  readonly toMs: number;
}

/** The week that holds a plant date, or the week of an instant in the plant zone. */
export function weekOf(dateOrMs: string | number, timeZone: string): PlantWeek {
  const date =
    typeof dateOrMs === 'string'
      ? Temporal.PlainDate.from(dateOrMs)
      : Temporal.Instant.fromEpochMilliseconds(dateOrMs).toZonedDateTimeISO(timeZone).toPlainDate();
  const monday = date.subtract({ days: date.dayOfWeek - 1 });
  const sunday = monday.add({ days: 6 });
  const from = monday.toZonedDateTime({ timeZone });
  const to = monday.add({ days: 7 }).toZonedDateTime({ timeZone });
  const week = monday.weekOfYear ?? 0;
  return {
    monday: monday.toString(),
    week,
    label: `W${week}, ${formatPlantDay(monday.toString())} to ${formatPlantDay(sunday.toString())}`,
    fromMs: from.epochMilliseconds,
    toMs: to.epochMilliseconds,
  };
}

/** The Monday a week before or after. */
export function shiftedWeek(monday: string, direction: 'earlier' | 'later'): string {
  return Temporal.PlainDate.from(monday)
    .add({ days: direction === 'earlier' ? -7 : 7 })
    .toString();
}

/** The plant dates of a week, Monday first. */
export function daysOf(week: PlantWeek): string[] {
  const monday = Temporal.PlainDate.from(week.monday);
  return Array.from({ length: 7 }, (_, index) => monday.add({ days: index }).toString());
}

/** "Mon 2 Nov 06:40" in plant time. */
export function plantTime(snapshot: PlantSettingsSnapshot, epochMs: number): string {
  return formatPlantDateTime(epochMs, snapshot.plant.timeZone);
}
