// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The seam between the order Gantt and its data (plan 18, Data loading): a data source answers a
// range and a filter with one snapshot in epoch milliseconds, with the analysis the view draws
// already in it. The screen never knows which source it has. Phase 1 has one source, the fixture G1
// of @northmes/planning-domain with its expected values as the analysis; the GraphQL source of
// planningGantt and the domain functions replace it value by value in phase 2.

/** The zoom presets of the approved board design D3, by their URL ids (plan 18, Shared pieces). */
export type ZoomPreset = 'hours' | 'day' | 'week' | '4weeks';

/** The filters of the job order table view, which apply to the Gantt unchanged (plan 18). */
export interface GanttFilter {
  /** Late only: orders late at now. */
  readonly lateOnly?: boolean;
  /** Search by order number. */
  readonly search?: string;
}

export interface GanttLoadInput {
  /** The first instant of the visible range, ISO 8601. */
  readonly from: string;
  /** The instant after the visible range, ISO 8601. */
  readonly to: string;
  readonly filter: GanttFilter;
}

/** A working-time calendar of the plant (ADR 0025): weekdays, one shift and its breaks. */
export interface GanttCalendar {
  readonly name: string;
  /** ISO weekdays, 1 for Monday to 7 for Sunday, that are working days. */
  readonly weekdays: readonly number[];
  readonly shift: { readonly start: string; readonly end: string };
  readonly breaks: readonly { readonly start: string; readonly end: string }[];
  readonly workingSecondsPerDay: number;
}

export interface GanttEquipment {
  readonly code: string;
  readonly name: string;
  readonly group: string;
  readonly isPlannable: boolean;
  /** The name of the machine's calendar. */
  readonly calendar: string;
}

export interface GanttRates {
  readonly cycleSeconds: number;
  readonly piecesPerCycle: number;
  readonly cyclesPerPiece: number;
  readonly planningFactor: number;
  readonly retoolSeconds: number;
  readonly fixedSeconds: number;
}

export interface GanttOperation {
  /** The display number, such as 1001.10, which is the operation's id in the snapshot. */
  readonly id: string;
  readonly displayNumber: string;
  readonly sequence: number;
  readonly name: string;
  readonly quantity: number;
  readonly rates: GanttRates;
  readonly leadTimeS: number;
  readonly sendAheadQuantity: number;
  readonly isLocked: boolean;
  readonly allowedEquipment: readonly string[];
}

/** A working segment of a placed job order: a span in open time. */
export interface GanttSegment {
  readonly fromMs: number;
  readonly toMs: number;
}

/** Where a job order lies: setup start, run start and end, with its working segments. */
export interface GanttPlacement {
  readonly setupStartMs: number;
  readonly runStartMs: number;
  readonly endMs: number;
  readonly segments: readonly GanttSegment[];
}

export type JobOrderStatus = 'planned' | 'started' | 'finished';

export interface GanttJobOrder {
  readonly id: string;
  readonly orderId: string;
  readonly operationId: string;
  readonly displayNumber: string;
  /** The machine's code; a job order without one sits in the Not placed row. */
  readonly equipment?: string;
  readonly quantity: number;
  readonly status: JobOrderStatus;
  /** Where the row lies; a job order without a placement sits in the Not placed row. */
  readonly placement?: GanttPlacement;
  readonly plannedSetupS: number;
  readonly plannedRunS: number;
  readonly rates: GanttRates;
}

export type OrderStatus = 'planned' | 'released';

export interface GanttOrder {
  readonly id: string;
  readonly number: string;
  readonly article: string;
  readonly quantity: number;
  /** The deadline as a plant date, "2026-11-06". */
  readonly deadlineDate: string;
  /** The deadline instant the server computed with the plant's deadline rule (plan 18). */
  readonly deadlineMs: number;
  readonly priority: number | null;
  /** The order color, a palette token name such as palette-1. */
  readonly color: string;
  readonly status: OrderStatus;
  readonly operations: readonly GanttOperation[];
  readonly jobOrders: readonly GanttJobOrder[];
}

export type BindingConstraintKind =
  | 'started'
  | 'hardLock'
  | 'frozenWindow'
  | 'earliestStart'
  | 'release'
  | 'machine'
  | 'calendar'
  | 'free';

/** What stops a row from starting earlier than it does (plan 18, Float and the critical chain). */
export interface BindingConstraint {
  readonly kind: BindingConstraintKind;
  /** The row that binds it, by display number. */
  readonly boundBy?: string;
  readonly equipment?: string;
  readonly detail?: string;
}

/** The float values of one job order row, in working seconds on its machine. */
export interface RowFloat {
  readonly earliestStartMs: number;
  readonly waitWorkingS: number;
  readonly latestStartMs: number;
  readonly latestEndMs: number;
  readonly totalFloatWorkingS: number;
  readonly freeFloatWorkingS: number;
  readonly binding: BindingConstraint;
  readonly critical: boolean;
}

/** The release of a row from its predecessor operation, which the link draws (plan 18). */
export interface RowRelease {
  /** The predecessor row that sets the release, by display number. */
  readonly fromRow: string;
  readonly fromJobOrderId: string;
  /** The release point: the predecessor's end, or the instant its send-ahead quantity is complete. */
  readonly pointMs: number;
  /** The release instant: the release point plus the lead time. */
  readonly atMs: number;
}

export type ConstraintKind =
  | 'deadline'
  | 'earliestStart'
  | 'release'
  | 'lastPiece'
  | 'hardLock'
  | 'started'
  | 'frozenWindow'
  | 'held'
  | 'allowedMachines'
  | 'oneJobAtATime'
  | 'calendar'
  | 'notPlannable';

/** One line of a row's constraint list (plan 18, The constraint list of a row). */
export interface ConstraintLine {
  readonly kind: ConstraintKind;
  /** The line as text: the kind, its value in plant time, and whether it holds. */
  readonly text: string;
  readonly holds: boolean;
  /** The conflict code of a broken line, such as LEAD_TIME. */
  readonly code?: string;
  /** The other rows or orders a broken line involves, by display number or order number. */
  readonly involves?: readonly string[];
}

export interface JobOrderAnalysis {
  /** The row's float values; none while they are unknown. */
  readonly float?: RowFloat;
  readonly release?: RowRelease;
  readonly constraints: readonly ConstraintLine[];
}

/** One row of an order's critical chain, from the last operation back to the root. */
export interface ChainRow {
  /** The display number. */
  readonly row: string;
  readonly jobOrderId: string;
  readonly orderId: string;
  /** The binding constraint as text, such as "release from 1003.10". */
  readonly bindingConstraint: string;
  readonly critical: boolean;
  readonly root: boolean;
  /** Set on a row of another order, with that order's number. */
  readonly otherOrder?: string;
  readonly totalFloatWorkingS?: number;
}

export interface OrderChain {
  readonly rows: readonly ChainRow[];
  /** The display numbers of the order's critical rows. */
  readonly criticalRows: readonly string[];
}

export interface OrderAnalysis {
  readonly late: boolean;
  /** Elapsed seconds from the planned end to the deadline, negative when late (plan 18, Slack). */
  readonly slackElapsedS: number;
  /** When late, the working time on the last row's machine that the order is late by. */
  readonly lateByWorking?: { readonly seconds: number; readonly equipment: string };
  readonly plannedStartMs?: number;
  readonly plannedEndMs?: number;
  readonly chain?: OrderChain;
}

/** Workload of one machine in one bucket (plan 18, Workload). */
export interface WorkloadBucket {
  /** The production day as a plant date. */
  readonly productionDay: string;
  readonly equipment: string;
  readonly availableS: number;
  readonly loadedS: number;
  readonly setupS: number;
  readonly runS: number;
  readonly utilizationPermille: number;
  readonly overloadS: number;
  readonly items: readonly { readonly jobOrder: string; readonly seconds: number }[];
}

export interface GanttAnalysis {
  /** By job order id. */
  readonly jobOrders: Readonly<Record<string, JobOrderAnalysis>>;
  /** By order id. */
  readonly orders: Readonly<Record<string, OrderAnalysis>>;
  readonly workload: readonly WorkloadBucket[];
}

export interface GanttSettings {
  readonly deadlineRule: 'endOfShift' | 'startOfDay';
  readonly shiftEndForDeadline: string;
  readonly frozenHours: number;
  readonly leadTimeBasis: 'elapsed' | 'working';
  readonly retoolOverlapsLeadTime: boolean;
}

/** What the order Gantt draws: the plant week in epoch milliseconds, with its analysis. */
export interface GanttSnapshot {
  /** The id of the fixture a mock source answers with, such as G1; a server source sets none. */
  readonly fixture?: string;
  readonly plant: {
    readonly slug: string;
    readonly timeZone: string;
    /** The production day start, "06:00" (ADR 0025). */
    readonly productionDayStart: string;
  };
  readonly settings: GanttSettings;
  readonly nowMs: number;
  /** The end of the frozen window, now plus frozenHours. */
  readonly fenceMs: number;
  /** The plant calendar, which summary rows shade and the machines of G1 share. */
  readonly calendar: GanttCalendar;
  readonly equipmentGroups: readonly { readonly code: string; readonly name: string }[];
  readonly equipment: readonly GanttEquipment[];
  readonly productionOrders: readonly GanttOrder[];
  readonly analysis: GanttAnalysis;
}

/** Where the order Gantt reads from. */
export interface GanttDataSource {
  readonly load: (input: GanttLoadInput) => Promise<GanttSnapshot>;
}

export { g1DataSource } from './gantt-data-g1.ts';
