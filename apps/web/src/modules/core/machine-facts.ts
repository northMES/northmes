// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { MachineRow } from './equipment-list.graphql.ts';
import type { PlantCalendar, PlantSettingsSnapshot } from './plant-settings-data.ts';

/** The facts of a machine that the machine pages share (design #688, MA1 to MA4). */

/**
 * The machine's calendar, which has no API yet: the fixture G1's calendar of a machine with the
 * same code, none where G1 has the machine off the board, and the plant calendar for a machine G1
 * does not know.
 */
export function calendarOf(
  snapshot: PlantSettingsSnapshot,
  code: string,
): PlantCalendar | undefined {
  const known = snapshot.equipment.find((machine) => machine.code === code);
  if (known === undefined) return snapshot.calendars.find((calendar) => calendar.plantDefault);
  return snapshot.calendars.find((calendar) => calendar.name === known.calendar);
}

/** The color of the machine's stripe: its own, else its group's. */
export function stripeColorOf(machine: Pick<MachineRow, 'color' | 'group'>): string | undefined {
  return machine.color ?? machine.group?.color;
}

/** The machines in a group, by code. */
export function machinesIn(machines: readonly MachineRow[], groupId: string): MachineRow[] {
  return machines
    .filter((machine) => machine.groupId === groupId)
    .sort((a, b) => a.code.localeCompare(b.code));
}
