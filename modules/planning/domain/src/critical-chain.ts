// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The critical chain of one order (plan 18, Float and the critical chain): from the row of the last
// operation that ends last, backward through each row's binding constraint, across other orders'
// rows where a reservation binds, to the root that explains why the order lies where it lies.
import {
  type BindingConstraint,
  type FloatResult,
  floatOf,
  lastRowOf,
  type RowFloat,
} from './float.ts';
import type { PlanContext, PlanJobOrder, PlanOrder } from './plan-context.ts';

/** The rows a chain lists before it says "chain continues" (plan 18, working default). */
export const chainRowLimit = 20;

export interface ChainRow {
  /** The display number. */
  readonly row: string;
  readonly jobOrderId: string;
  readonly orderId: string;
  /** Set on a row of another order, with that order's number. */
  readonly otherOrder?: string;
  readonly binding: BindingConstraint;
  /** The binding constraint as text, such as "release from 1003.10". */
  readonly bindingText: string;
  readonly waitWorkingS: number;
  readonly totalFloatWorkingS: number;
  readonly freeFloatWorkingS: number;
  readonly critical: boolean;
  /** The last row of the chain, whose binding constraint is the root cause. */
  readonly root: boolean;
}

export interface ChainResult {
  readonly late: boolean;
  readonly slackElapsedS: number;
  readonly rows: readonly ChainRow[];
  /** The display numbers of the order's critical rows. */
  readonly criticalRows: readonly string[];
  /** Whether the chain stopped at the row limit before it reached a root. */
  readonly continues: boolean;
}

/** The binding constraint as the chain and the detail panel word it. */
export function bindingText(binding: BindingConstraint): string {
  switch (binding.kind) {
    case 'started':
      return 'started';
    case 'hardLock':
      return 'hard lock';
    case 'frozenWindow':
      return 'frozen window';
    case 'earliestStart':
      return 'earliest start of the order';
    case 'release':
      return `release from ${binding.boundBy ?? '?'}`;
    case 'machine':
      return `machine ${binding.equipment ?? '?'} occupied by ${binding.boundBy ?? '?'}`;
    case 'calendar':
      return 'calendar';
    case 'free':
      return 'free';
  }
}

/** The order of a row in the loaded plan, by the row's display number. */
function orderOfRow(
  context: PlanContext,
  displayNumber: string,
): { order: PlanOrder; row: PlanJobOrder } | undefined {
  for (const order of context.orders) {
    const row = order.jobOrders.find((each) => each.displayNumber === displayNumber);
    if (row !== undefined) return { order, row };
  }
  return undefined;
}

/**
 * The chain of an order: each row with its wait, floats and binding constraint, from the last row
 * back to the root, through the predecessor a release names and the reservation a machine names.
 * The floats of another order's rows come from that order's own floatOf, computed once per order.
 */
export function criticalChain(order: PlanOrder, context: PlanContext): ChainResult {
  const floats = new Map<string, FloatResult>();
  const floatsOf = (each: PlanOrder): FloatResult => {
    const known = floats.get(each.id);
    if (known !== undefined) return known;
    const computed = floatOf(each, context);
    floats.set(each.id, computed);
    return computed;
  };
  const own = floatsOf(order);
  const criticalRows = order.jobOrders
    .filter((row) => own.rows[row.id]?.critical === true)
    .map((row) => row.displayNumber)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const rows: ChainRow[] = [];
  let continues = false;
  let current: { order: PlanOrder; row: PlanJobOrder } | undefined = (() => {
    const last = lastRowOf(order);
    return last === undefined ? undefined : { order, row: last };
  })();
  const visited = new Set<string>();
  while (current !== undefined) {
    const { order: at, row } = current;
    const values: RowFloat | undefined = floatsOf(at).rows[row.id];
    if (values === undefined || visited.has(row.id)) break;
    visited.add(row.id);
    const binding = values.binding;
    const next =
      binding.kind === 'release' || binding.kind === 'machine'
        ? binding.boundBy === undefined
          ? undefined
          : orderOfRow(context, binding.boundBy)
        : undefined;
    const root = next === undefined;
    if (rows.length >= chainRowLimit) {
      continues = true;
      break;
    }
    rows.push({
      row: row.displayNumber,
      jobOrderId: row.id,
      orderId: at.id,
      ...(at.id !== order.id && { otherOrder: at.number }),
      binding,
      bindingText: bindingText(binding),
      waitWorkingS: values.waitWorkingS,
      totalFloatWorkingS: values.totalFloatWorkingS,
      freeFloatWorkingS: values.freeFloatWorkingS,
      critical: values.critical,
      root,
    });
    current = next;
  }
  return { late: own.late, slackElapsedS: own.slackElapsedS, rows, criticalRows, continues };
}
