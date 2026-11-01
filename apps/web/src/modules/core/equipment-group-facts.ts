// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { paletteColors } from '@northmes/contracts';
import type { GroupColorFrom, PlantMachine, PlantSettingsSnapshot } from './plant-settings-data.ts';

/** The facts of the equipment groups that the groups pages share (design #729, EG1 to EG5). */

/** A group as the facts read it: its id, its code and its palette color. */
export interface ColoredGroup {
  readonly id: string;
  readonly code: string;
  readonly color: string;
}

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
  if (from === 'set') return 'Someone set it here. The import never replaces it.';
  if (from === 'palette') {
    return 'No color was picked, so the group took the first of the 20 palette colors that no other group used. The group keeps it.';
  }
  return 'The ERP sent it with the first import. The group keeps it: a later import color does not replace it.';
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

/** The codes of the groups that use each palette color, leaving out the group `exceptId`. */
export function colorUsers(
  groups: readonly ColoredGroup[],
  exceptId?: string,
): Map<string, string[]> {
  const users = new Map<string, string[]>();
  for (const group of groups) {
    if (group.id === exceptId) continue;
    users.set(group.color, [...(users.get(group.color) ?? []), group.code]);
  }
  return users;
}

/**
 * The color a new group without a picked color takes, as the API picks it: the first palette color
 * that none of these groups, the active ones the plant sees, uses, else palette-1.
 */
export function firstFreeColor(groups: readonly ColoredGroup[]): string {
  const taken = new Set(groups.map((group) => group.color));
  return paletteColors.find((color) => !taken.has(color)) ?? 'palette-1';
}
