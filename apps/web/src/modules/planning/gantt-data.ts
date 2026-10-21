// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The seam between the order Gantt and its data (plan 18, Data loading): a data source answers a
// range and a filter with one snapshot in epoch milliseconds, with the analysis the view draws
// already in it. The screen never knows which source it has. Phase 1 has one source, the fixture G1
// of @northmes/planning-domain with its expected values as the analysis; the GraphQL source of
// planningGantt and the domain functions replace it value by value in phase 2.

import type {
  BindingConstraint,
  BindingConstraintKind,
  CalendarDeviation,
  ChainRow,
  ConstraintCode,
  ConstraintKind,
  EarlyOrder,
  RowFloat,
  Release as RowRelease,
  Run,
  RunResult,
  SavedSetup,
  WorkloadBucket,
} from '@northmes/planning-domain';

export type {
  BindingConstraint,
  BindingConstraintKind,
  CalendarDeviation,
  ChainRow,
  ConstraintCode,
  ConstraintKind,
  EarlyOrder,
  RowFloat,
  RowRelease,
  Run,
  RunResult,
  SavedSetup,
  WorkloadBucket,
};

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
  /** The plant's deviations: overtime and non-working time, plant-wide or per machine (ADR 0025). */
  readonly deviations?: readonly CalendarDeviation[];
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
  /** The actual start of a started row. */
  readonly actualStartMs?: number;
  /** Whether another planner's live soft lock holds the row (plan 07, Held). */
  readonly held?: boolean;
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
  /**
   * Who owns the order's master fields: the ERP, or NorthMES for an order created in the app. The
   * one source of ownership; `origin` only adds the details.
   */
  readonly owner: RecordOwner;
  readonly operations: readonly GanttOperation[];
  readonly jobOrders: readonly GanttJobOrder[];
  /** Where the order came from; a snapshot without the planning pages' data leaves it out. */
  readonly origin?: OrderOrigin;
  /**
   * The ERP's free fields on an imported order, kept as sent for display (plan 07, external
   * data), in the order the ERP sent them; board fields can show them by key (#762).
   */
  readonly externalData?: readonly ExternalDataEntry[];
}

/** One free field the ERP sent with an order: its key and its value as text. */
export interface ExternalDataEntry {
  readonly key: string;
  readonly value: string;
}

/**
 * A field a module contributes to the block fields slot `planning/board/block-fields/v1` (plan 07;
 * ADR 0068): per job order id, the short text a block draws at its trailing edge, the words the
 * block's name carries and the value its hover card lists (#762).
 */
export interface ModuleField {
  /** The contribution's id, such as connector.erpChange. */
  readonly id: string;
  readonly label: string;
  /** The module that contributes it, which the board settings page names as the source. */
  readonly module: string;
  readonly values: Readonly<
    Record<
      string,
      { readonly text: string; readonly accessibleText: string; readonly hoverText: string }
    >
  >;
}

/** Who owns a record's master fields: the ERP through the connector, or NorthMES itself. */
export type RecordOwner = 'erp' | 'northmes';

/**
 * Where an order came from (plan 07, field ownership): the import that brought an imported order,
 * or the creator of an order created in NorthMES. Who owns the order's master fields is the
 * order's own `owner`; the origin only adds the details.
 */
export interface OrderOrigin {
  readonly importedAtMs?: number;
  readonly createdAtMs?: number;
  readonly createdBy?: string;
  /** The version of the article's routing the order's operations were copied from. */
  readonly routingVersion?: number;
}

export interface Customer {
  readonly code: string;
  readonly name: string;
}

/** One customer order line (plan 07, customer orders and demand) and the order that supplies it. */
export interface CustomerOrderLine {
  readonly id: string;
  readonly customerOrder: string;
  /** The customer's own order number. */
  readonly customersReference: string;
  readonly customerCode: string;
  readonly line: number;
  readonly article: string;
  readonly quantity: number;
  /** The wanted date as a plant date, "2026-11-06". */
  readonly wantedDate: string;
  /** The id of the production order that supplies the line; none while there is none. */
  readonly productionOrderId?: string;
  /** The slug of the plant that delivers the line, which a company admin sets (design #728). */
  readonly deliveringPlant?: string;
}

/** A plant of the company that a customer order line names, with the name a page shows. */
export interface CompanyPlant {
  readonly slug: string;
  readonly name: string;
}

export interface RoutingOperation {
  readonly sequence: number;
  readonly name: string;
  readonly allowedEquipment: readonly string[];
}

/** A routing as planning reads it: the article's operations and their allowed machines. */
export interface Routing {
  readonly article: string;
  readonly version: number;
  readonly operations: readonly RoutingOperation[];
}

export interface HistoryChange {
  readonly field: string;
  readonly before: string;
  readonly after: string;
}

/** One entry of an order's history (design ui-222, DE3): who changed what, where and why. */
export interface HistoryEntry {
  readonly id: string;
  readonly atMs: number;
  readonly by: string;
  readonly surface: string;
  readonly reason?: string;
  readonly summary: string;
  readonly changes: readonly HistoryChange[];
}

/** The ERP connection as configured in Settings: its name is a value, never part of a label. */
export interface ErpConnection {
  readonly name: string;
  /** The instant of the last import, "ERP data as of". */
  readonly importedAtMs: number;
}

/** One line of a row's constraint list (plan 18, The constraint list of a row), rendered as text. */
export interface ConstraintLine {
  readonly kind: ConstraintKind;
  /** The line as text: the kind, its value in plant time, and whether it holds. */
  readonly text: string;
  readonly holds: boolean;
  /** The conflict code of a broken line, such as LEAD_TIME. */
  readonly code?: ConstraintCode;
  /** The other rows or orders a broken line involves, by display number or order number. */
  readonly involves?: readonly string[];
  /** The instant that clears a broken release or last-piece line. */
  readonly clearsAtMs?: number;
}

export interface JobOrderAnalysis {
  /** The row's float values; none while they are unknown. */
  readonly float?: RowFloat;
  readonly release?: RowRelease;
  readonly constraints: readonly ConstraintLine[];
}

export interface OrderChain {
  readonly rows: readonly ChainRow[];
  /** The display numbers of the order's critical rows. */
  readonly criticalRows: readonly string[];
  /** Whether the chain stopped at the row limit before it reached a root. */
  readonly continues: boolean;
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
  /** The runs over the orders (ADR 0083): the draft's until Save, then the committed ones. */
  readonly runs?: readonly Run[];
  readonly analysis: GanttAnalysis;
  // What the planning pages beside the Gantt show (the production order page and the lists); a
  // source that answers the Gantt alone leaves them out.
  readonly erp?: ErpConnection;
  readonly plants?: readonly CompanyPlant[];
  readonly customers?: readonly Customer[];
  readonly customerOrderLines?: readonly CustomerOrderLine[];
  readonly routings?: readonly Routing[];
  /** The history of each order, newest first, by order id. */
  readonly history?: Readonly<Record<string, readonly HistoryEntry[]>>;
  /** The fields the installed modules contribute to the block fields slot (#762). */
  readonly moduleFields?: readonly ModuleField[];
}

/** Where the order Gantt reads from. */
export interface GanttDataSource {
  readonly load: (input: GanttLoadInput) => Promise<GanttSnapshot>;
}

export { g1DataSource } from './gantt-data-g1.ts';
