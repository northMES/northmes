// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type {
  GroupColorFrom,
  PlantEquipmentGroup,
  PlantMachine,
  PlantRecordOwner,
  PlantSettingsSnapshot,
} from './plant-settings-data.ts';

/** The facts of the equipment groups that the groups pages share (design #729, EG1 to EG5). */

/** The 20 palette colors a group can take, as token names: palette-1 to palette-20. */
export const paletteColors: readonly string[] = Array.from(
  { length: 20 },
  (_, index) => `palette-${index + 1}`,
);

/** A palette token in words: "Color 3" for palette-3. */
export function colorText(color: string): string {
  const number = /^palette-(\d+)$/.exec(color)?.[1];
  return number === undefined ? color : `Color ${number}`;
}

/** Where a group's color came from, as the list's Color from column says it. */
export function colorFromText(from: GroupColorFrom): string {
  if (from === 'set') return 'Set here';
  return from === 'palette' ? 'Assigned from the palette' : 'From the ERP';
}

/** Where a group's color came from, as its page says it under the color. */
export function colorNote(from: GroupColorFrom): string {
  if (from === 'set') return 'A plant admin set it here. The import never replaces it.';
  if (from === 'palette') {
    return 'The ERP sent no color, so the group took the first of the 20 palette colors that no other group used. The group keeps it.';
  }
  return 'The ERP sent it with the first import. The group keeps it: a later import color does not replace it.';
}

/** Who owns a group's master fields, as the list's Source column says it. */
export function ownerText(owner: PlantRecordOwner): string {
  return owner === 'northmes' ? 'Created in NorthMES' : 'From the ERP';
}

/** The plant's machines in a group, by code. */
export function machinesOf(snapshot: PlantSettingsSnapshot, code: string): PlantMachine[] {
  return snapshot.equipment
    .filter((machine) => machine.group === code)
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** "3 machines", "1 machine" or "No machines". */
export function machineCountText(count: number): string {
  if (count === 0) return 'No machines';
  return count === 1 ? '1 machine' : `${count} machines`;
}

/** The codes of the other groups that use each palette color. */
export function colorUsers(
  snapshot: PlantSettingsSnapshot,
  except: PlantEquipmentGroup,
): Map<string, string[]> {
  const users = new Map<string, string[]>();
  for (const group of snapshot.equipmentGroups) {
    if (group.code === except.code) continue;
    users.set(group.color, [...(users.get(group.color) ?? []), group.code]);
  }
  return users;
}
