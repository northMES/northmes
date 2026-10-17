// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The loaded plan as every scheduling function reads it (plan 18, Functions): the orders with their
// operations and job orders in epoch milliseconds, availability per machine, now, the fence and the
// plant settings. The web's Gantt snapshot and the server's snapshot loader both produce this shape,
// so a result shown as a preview is the result the server computes at Save (ADR 0057).
import type { Windows } from './calendar/windows.ts';
import type { Rates } from './duration.ts';

export type { Rates };

export interface PlanSettings {
  /** Elapsed hours after now in which a row keeps its machine and its order (plan 07). */
  readonly frozenHours: number;
  /** Whether a lead time counts elapsed clock time or working time on the later machine. */
  readonly leadTimeBasis: 'elapsed' | 'working';
  /** Whether the release bounds the run start, so retool may run during the lead time. */
  readonly retoolOverlapsLeadTime: boolean;
}

export interface PlanOperation {
  /** The operation's id in the loaded plan; the display number in the fixtures. */
  readonly id: string;
  readonly displayNumber: string;
  readonly sequence: number;
  readonly quantity: number;
  readonly rates: Rates;
  readonly leadTimeS: number;
  readonly sendAheadQuantity: number;
  readonly isLocked: boolean;
  readonly allowedEquipment: readonly string[];
}

/** Where a job order lies: setup start, run start and end. */
export interface JobOrderSpan {
  readonly setupStartMs: number;
  readonly runStartMs: number;
  readonly endMs: number;
}

export type JobOrderStatus = 'planned' | 'started' | 'finished';

export interface PlanJobOrder {
  readonly id: string;
  readonly operationId: string;
  readonly displayNumber: string;
  /** The machine's code; none for a job order in the Not placed row. */
  readonly equipment?: string;
  readonly quantity: number;
  readonly status: JobOrderStatus;
  readonly placement?: JobOrderSpan;
  readonly plannedSetupS: number;
  readonly plannedRunS: number;
  readonly rates: Rates;
  /** The actual start of a started row. */
  readonly actualStartMs?: number;
  /** Whether another planner's live soft lock holds the row (plan 07, Held). */
  readonly held?: boolean;
}

export interface PlanOrder {
  readonly id: string;
  readonly number: string;
  /** The deadline instant the server computed with the plant's deadline rule. */
  readonly deadlineMs: number;
  /** The earliest start of the order, when the plant setting enables it (plan 18). */
  readonly earliestStartMs?: number | null;
  readonly priority: number | null;
  readonly operations: readonly PlanOperation[];
  readonly jobOrders: readonly PlanJobOrder[];
}

export interface PlanContext {
  readonly nowMs: number;
  /** The end of the frozen window, now plus frozenHours. */
  readonly fenceMs: number;
  readonly settings: PlanSettings;
  /** Availability per machine code, over the loaded horizon. */
  readonly availability: Readonly<Record<string, Windows>>;
  /** Every loaded order; the rows of every order on a machine are its reservations. */
  readonly orders: readonly PlanOrder[];
  /** The snap step of the view, within which a reservation's end counts as binding; none means exact. */
  readonly snapStepMs?: number;
}

/** Compares by code units, as every comparator of the domain does (ADR 0028). */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Rows by display number, then id: the tie order of plan 18. */
export function compareRows(a: PlanJobOrder, b: PlanJobOrder): number {
  return compareCodeUnits(a.displayNumber, b.displayNumber) || compareCodeUnits(a.id, b.id);
}

/** The operations of an order in sequence order, then display number and id. */
export function operationsInSequence(order: PlanOrder): PlanOperation[] {
  return [...order.operations].sort(
    (a, b) =>
      a.sequence - b.sequence ||
      compareCodeUnits(a.displayNumber, b.displayNumber) ||
      compareCodeUnits(a.id, b.id),
  );
}

/** The rows of an operation in the tie order. */
export function rowsOfOperation(order: PlanOrder, operation: PlanOperation): PlanJobOrder[] {
  return order.jobOrders.filter((row) => row.operationId === operation.id).sort(compareRows);
}

/** A placed row on a machine, with its order, as the machine's reservations list them. */
export interface Reservation {
  readonly order: PlanOrder;
  readonly row: PlanJobOrder;
  readonly span: JobOrderSpan;
}

/** The placed rows of every loaded order on a machine, by setup start, then display number and id. */
export function reservationsOn(context: PlanContext, equipment: string): Reservation[] {
  const reservations: Reservation[] = [];
  for (const order of context.orders) {
    for (const row of order.jobOrders) {
      if (row.equipment === equipment && row.placement !== undefined) {
        reservations.push({ order, row, span: row.placement });
      }
    }
  }
  return reservations.sort(
    (a, b) => a.span.setupStartMs - b.span.setupStartMs || compareRows(a.row, b.row),
  );
}

/** The availability of a machine, empty for a machine the context does not hold. */
export function availabilityOn(context: PlanContext, equipment: string | undefined): Windows {
  return equipment === undefined ? [] : (context.availability[equipment] ?? []);
}
