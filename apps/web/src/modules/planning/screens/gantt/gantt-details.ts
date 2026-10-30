// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// What the Details drawer of a job order leads with (#917; plan 18, Details): the one exception
// line of its header, the sections that open by themselves, the job orders before and after it in
// the order, and the plant's hover fields that have no place above.
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { type ShownField, shownFields } from '../../board-fields.ts';
import type { ConstraintLine, GanttSnapshot, OrderAnalysis } from '../../gantt-data.ts';
import type { MaterialShortage } from '../../material-projection.ts';
import { materialShortText } from './gantt-block-states.ts';
import type { JobOrderRow } from './gantt-rows.ts';

/** The exception line of a job order's header, by the kind that picked it. */
export interface DetailsException {
  readonly kind: 'constraint' | 'late' | 'early' | 'material' | 'held' | 'locked';
  readonly text: string;
}

/**
 * A broken line of the constraint list that is a conflict: every line but the deadline, which a
 * late order breaks on each of its rows as a warning (plan 07, Conflicts) and the late line says.
 */
function isConflict(line: ConstraintLine): boolean {
  return !line.holds && line.kind !== 'deadline';
}

/**
 * The one exception of a job order, in this order: a broken constraint, lateness, a material
 * shortage, another planner's hold, a hard lock. A row that ends after the order deadline says by
 * how much; an earlier row of a late order says the order's lateness, which its broken deadline
 * line stands for. None when nothing is wrong.
 */
export function exceptionOf(
  row: JobOrderRow,
  shortages: readonly MaterialShortage[],
  order?: OrderAnalysis,
): DetailsException | undefined {
  const broken = row.analysis?.constraints.find(isConflict);
  if (broken !== undefined) {
    return {
      kind: 'constraint',
      text: broken.code === undefined ? broken.text : `${broken.text} (${broken.code})`,
    };
  }
  const endMs = row.jobOrder.placement?.endMs;
  if (endMs !== undefined && endMs > row.order.deadlineMs) {
    const late = formatDuration((endMs - row.order.deadlineMs) / 1000);
    return { kind: 'late', text: `Ends ${late} after the order deadline` };
  }
  if (order?.late === true) {
    const late = formatDuration(-order.slackElapsedS);
    return { kind: 'late', text: `Order ${row.order.number} ends ${late} after its deadline` };
  }
  const shortage = shortages[0];
  if (shortage !== undefined) {
    return { kind: 'material', text: `Material short: ${materialShortText(shortage)}` };
  }
  if (row.jobOrder.held === true) {
    return { kind: 'held', text: "Held: another planner's draft holds the order" };
  }
  if (row.operation.isLocked) {
    return { kind: 'locked', text: 'Locked: keeps its machine and its start' };
  }
  return undefined;
}

/** The constraint lines with the broken ones first, each group in the list's own order. */
export function brokenFirst(lines: readonly ConstraintLine[]): ConstraintLine[] {
  return [...lines.filter((line) => !line.holds), ...lines.filter((line) => line.holds)];
}

/** The sections that open by themselves: the one the header's exception points into. */
export function openSectionsOf(exception: DetailsException | undefined): {
  readonly constraints: boolean;
  readonly material: boolean;
} {
  return {
    constraints: exception?.kind === 'constraint',
    material: exception?.kind === 'material',
  };
}

/** A job order of the operation before or after, as At a glance names it (design D3). */
export interface LinkedJobOrder {
  readonly label: 'Before' | 'After';
  readonly text: string;
}

/**
 * The job orders of the operations before and after the row's in its order (design D3, "Linked
 * job orders"): the one before by its end, which the row waits for, and the one after by its start.
 * An operation split into several job orders names the last to end, or the first to start.
 */
export function linkedJobOrdersOf(
  row: JobOrderRow,
  machineName: (code: string | undefined) => string,
  timeZone: string,
): LinkedJobOrder[] {
  const operations = [...row.order.operations].sort((a, b) => a.sequence - b.sequence);
  const index = operations.findIndex((each) => each.id === row.operation.id);
  const jobOrdersOf = (operationId: string | undefined) =>
    row.order.jobOrders.filter((each) => each.operationId === operationId);
  const linked: LinkedJobOrder[] = [];
  const before = jobOrdersOf(operations[index - 1]?.id).sort(
    (a, b) => (b.placement?.endMs ?? 0) - (a.placement?.endMs ?? 0),
  )[0];
  if (before !== undefined) {
    linked.push({
      label: 'Before',
      text:
        before.placement === undefined
          ? `${before.displayNumber}, not placed`
          : `${before.displayNumber} on ${machineName(before.equipment)}, ends ${formatPlantDateTime(before.placement.endMs, timeZone)}`,
    });
  }
  const after = jobOrdersOf(index < 0 ? undefined : operations[index + 1]?.id).sort(
    (a, b) =>
      (a.placement?.setupStartMs ?? Number.POSITIVE_INFINITY) -
      (b.placement?.setupStartMs ?? Number.POSITIVE_INFINITY),
  )[0];
  if (after !== undefined) {
    linked.push({
      label: 'After',
      text:
        after.placement === undefined
          ? `${after.displayNumber}, not placed`
          : `${after.displayNumber} on ${machineName(after.equipment)}, starts ${formatPlantDateTime(after.placement.setupStartMs, timeZone)}`,
    });
  }
  return linked;
}

/**
 * The hover fields the drawer shows elsewhere: in its title, subline, status badge and exception
 * line (Late by), in At a glance, or in the Setup and run section (Run start). Plan 07 keeps every
 * hover field in Details too.
 */
const placedFieldIds: ReadonlySet<string> = new Set([
  'operation',
  'article',
  'quantity',
  'status',
  'lateBy',
  'machine',
  'setupStart',
  'end',
  'orderDeadline',
  'freeFloat',
  'customer',
  'setupAndRun',
  'runStart',
]);

/** The plant's hover fields that have no place above, which At a glance lists in their order. */
export function otherHoverFields(
  hoverIds: readonly string[],
  row: JobOrderRow,
  snapshot: GanttSnapshot,
  machineName: (code: string | undefined) => string,
): ShownField[] {
  return shownFields(
    hoverIds.filter((id) => !placedFieldIds.has(id)),
    row,
    snapshot,
    machineName,
  );
}
