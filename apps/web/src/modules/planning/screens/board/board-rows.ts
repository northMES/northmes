// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { availabilityOf, subtractWindows } from '@northmes/planning-domain';
import { workingCalendarOf } from '../../gantt-analysis.ts';
import type { GanttEquipment, GanttSnapshot } from '../../gantt-data.ts';
import type { ClosedWindow, TimeRange } from '../../timeline/time-scale.ts';
import { buildGanttRows, type JobOrderRow, jobOrderRowsOf } from '../gantt/gantt-rows.ts';

/** A machine row of the board: the machine and its job orders in the range, in time order. */
export interface BoardMachine {
  readonly equipment: GanttEquipment;
  readonly blocks: readonly JobOrderRow[];
  /** The machine's closed time inside the range, from its availability (ADR 0025). */
  readonly closed: readonly ClosedWindow[];
}

/** An equipment group band and its machine rows (plan 07, Planning board in release 1). */
export interface BoardGroup {
  readonly code: string;
  readonly name: string;
  /** The group color, a palette token name such as palette-3, when the group has one. */
  readonly color?: string;
  readonly machines: readonly BoardMachine[];
}

/** What the board draws of a snapshot over a range: the groups, and the rows without a place. */
export interface BoardModel {
  readonly groups: readonly BoardGroup[];
  readonly notPlaced: readonly JobOrderRow[];
}

/** Job order rows by setup start, then by id, so a machine row reads left to right. */
function byStart(a: JobOrderRow, b: JobOrderRow): number {
  const aStart = a.jobOrder.placement?.setupStartMs ?? 0;
  const bStart = b.jobOrder.placement?.setupStartMs ?? 0;
  if (aStart !== bStart) return aStart - bStart;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The board of a snapshot over a range (plan 07, Planning board in release 1; design D3): the
 * plannable machines grouped by equipment group in the snapshot's order, each with the job orders
 * whose span touches the range in time order and its closed time from the machine's availability,
 * so a machine deviation shades only its own row. A group without a plannable machine is left out.
 */
export function boardModelOf(snapshot: GanttSnapshot, range: TimeRange): BoardModel {
  const rows = buildGanttRows(snapshot).flatMap((row) => jobOrderRowsOf(row));
  const calendar = workingCalendarOf(snapshot.calendar, snapshot.plant.timeZone);
  const machineOf = (equipment: GanttEquipment): BoardMachine => {
    const open = availabilityOf(calendar, equipment.code, range.fromMs, range.toMs);
    return {
      equipment,
      blocks: rows
        .filter((row) => {
          const placement = row.jobOrder.placement;
          return (
            row.jobOrder.equipment === equipment.code &&
            placement !== undefined &&
            placement.endMs > range.fromMs &&
            placement.setupStartMs < range.toMs
          );
        })
        .sort(byStart),
      closed: subtractWindows([{ fromMs: range.fromMs, toMs: range.toMs }], open),
    };
  };
  const groups = snapshot.equipmentGroups.flatMap((group) => {
    const machines = snapshot.equipment
      .filter((equipment) => equipment.group === group.code && equipment.isPlannable)
      .map(machineOf);
    return machines.length === 0
      ? []
      : [
          {
            code: group.code,
            name: group.name,
            ...(group.color !== undefined && { color: group.color }),
            machines,
          },
        ];
  });
  return {
    groups,
    notPlaced: rows.filter((row) => row.jobOrder.placement === undefined).sort(byStart),
  };
}
