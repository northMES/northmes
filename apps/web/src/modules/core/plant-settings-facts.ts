// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime, formatPlantDay } from '@northmes/contracts/format';
import { Temporal } from 'temporal-polyfill';
import type {
  PlantCalendar,
  PlantMachine,
  PlantRouting,
  PlantSettingsSnapshot,
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

/** "Mon to Fri 06:00 to 15:00": the working days as a span and the shift. */
export function shiftText(calendar: PlantCalendar): string {
  const days = [...calendar.weekdays].sort((a, b) => a - b);
  const first = days[0];
  const last = days[days.length - 1];
  const span =
    first === undefined || last === undefined
      ? 'No working days'
      : first === last
        ? weekdayName(first).slice(0, 3)
        : `${weekdayName(first).slice(0, 3)} to ${weekdayName(last).slice(0, 3)}`;
  return `${span} ${calendar.shift.start} to ${calendar.shift.end}`;
}

/** "breaks 08:30 to 08:45 and 11:00 to 11:30", or "no breaks". */
export function breaksText(calendar: PlantCalendar): string {
  const spans = calendar.breaks.map((each) => `${each.start} to ${each.end}`);
  if (spans.length === 0) return 'no breaks';
  if (spans.length === 1) return `break ${spans[0]}`;
  return `breaks ${spans.slice(0, -1).join(', ')} and ${spans[spans.length - 1]}`;
}

/** The working seconds of one cycle of the pattern, every working day once. */
export function weeklyWorkingSeconds(calendar: PlantCalendar): number {
  return calendar.weekdays.length * calendar.workingSecondsPerDay;
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
