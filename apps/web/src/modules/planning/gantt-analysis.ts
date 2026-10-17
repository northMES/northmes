// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The analysis of a Gantt snapshot from the domain functions (plan 18, Where the computation runs):
// the snapshot's orders are the plan context of @northmes/planning-domain, so floatOf,
// criticalChain, releaseOf, constraintsOf and workload run over the loaded plan in the browser, the
// draft included, with the same code the server runs at Save (ADR 0057). The text the screens show
// for a constraint line and a binding constraint is rendered here, from the structured values.
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import {
  addWork,
  availabilityOf,
  constraintsOf,
  criticalChain,
  type ConstraintLine as DomainConstraintLine,
  floatOf,
  type PlanContext,
  type PlanEquipment,
  productionDayBuckets,
  type RowFloat,
  type Release as RowRelease,
  releaseOf,
  type Windows,
  type WorkingCalendar,
  weeklyCalendar,
  workload,
} from '@northmes/planning-domain';
import { Temporal } from 'temporal-polyfill';
import type {
  ConstraintLine,
  GanttAnalysis,
  GanttCalendar,
  GanttJobOrder,
  GanttOrder,
  GanttPlacement,
  GanttSnapshot,
  JobOrderAnalysis,
  OrderAnalysis,
} from './gantt-data.ts';

/** A snapshot before its analysis. */
export type GanttSnapshotBase = Omit<GanttSnapshot, 'analysis'>;

/** A half-open range in epoch milliseconds. */
export interface AnalysisRange {
  readonly fromMs: number;
  readonly toMs: number;
}

const day = 86_400_000;

/** The plant calendar of a snapshot as the domain reads it. */
export function workingCalendarOf(calendar: GanttCalendar, timeZone: string): WorkingCalendar {
  return weeklyCalendar({
    timeZone,
    weekdays: calendar.weekdays,
    shift: calendar.shift,
    breaks: calendar.breaks,
    deviations: calendar.deviations ?? [],
  });
}

/**
 * The horizon the analysis expands availability over: the visible range, every placement and
 * every deadline of the snapshot, with a day before and four weeks after, so a latest placement
 * laid backward from a deadline and a cascade laid forward both stay inside it.
 */
function horizonOf(base: GanttSnapshotBase, range: AnalysisRange): AnalysisRange {
  let fromMs = Math.min(range.fromMs, base.nowMs);
  let toMs = Math.max(range.toMs, base.fenceMs);
  for (const order of base.productionOrders) {
    toMs = Math.max(toMs, order.deadlineMs);
    for (const row of order.jobOrders) {
      if (row.placement === undefined) continue;
      fromMs = Math.min(fromMs, row.placement.setupStartMs);
      toMs = Math.max(toMs, row.placement.endMs);
    }
  }
  return { fromMs: fromMs - day, toMs: toMs + 28 * day };
}

/**
 * The plan context of a snapshot: its orders as they are (the snapshot's shapes are the domain's),
 * availability per machine from the plant calendar over the horizon, now, the fence, the settings
 * and the machines. A machine's own calendar comes with core's availability query; until then
 * every machine shares the plant calendar, with its own deviations applied.
 */
export function planContextOf(base: GanttSnapshotBase, range: AnalysisRange): PlanContext {
  const calendar = workingCalendarOf(base.calendar, base.plant.timeZone);
  const horizon = horizonOf(base, range);
  const availability: Record<string, Windows> = {};
  const equipment: Record<string, PlanEquipment> = {};
  for (const machine of base.equipment) {
    availability[machine.code] = availabilityOf(
      calendar,
      machine.code,
      horizon.fromMs,
      horizon.toMs,
    );
    equipment[machine.code] = { isPlannable: machine.isPlannable, calendar: machine.calendar };
  }
  return {
    nowMs: base.nowMs,
    fenceMs: base.fenceMs,
    settings: base.settings,
    availability,
    orders: base.productionOrders,
    equipment,
  };
}

/** A placement with its working segments laid over the machine's availability. */
export function placementWithSegments(
  row: Pick<GanttJobOrder, 'plannedSetupS' | 'plannedRunS'>,
  span: Pick<GanttPlacement, 'setupStartMs' | 'runStartMs' | 'endMs'>,
  windows: Windows,
): GanttPlacement {
  const laid = addWork(windows, span.setupStartMs, row.plannedSetupS + row.plannedRunS);
  const segments =
    laid === null || laid.segments.length === 0
      ? [{ fromMs: span.setupStartMs, toMs: span.endMs }]
      : laid.segments;
  return {
    setupStartMs: span.setupStartMs,
    runStartMs: span.runStartMs,
    endMs: span.endMs,
    segments,
  };
}

/** The context the text renderers need: the plant zone and the machine names. */
export interface TextContext {
  readonly timeZone: string;
  readonly machineName: (code: string | undefined) => string;
  readonly calendarName: string;
}

/**
 * A constraint line as the detail panel shows it (plan 18, The constraint list of a row): the
 * kind, its value in plant time and whether it holds, with the conflict code and the rows a broken
 * line involves.
 */
export function constraintText(line: DomainConstraintLine, text: TextContext): ConstraintLine {
  const at = (ms: number) => formatPlantDateTime(ms, text.timeZone);
  const base = {
    kind: line.kind,
    holds: line.holds,
    ...(line.code !== undefined && { code: line.code }),
    ...(line.involves !== undefined && { involves: line.involves }),
  };
  switch (line.kind) {
    case 'deadline': {
      const order = line.involves?.[0];
      const of = order === undefined ? 'Deadline' : `Deadline of order ${order}`;
      return {
        ...base,
        text: line.holds
          ? `${of}: ${at(line.atMs)}, slack ${formatDuration(line.slackElapsedS)}`
          : `${of}: ${at(line.atMs)}, late by ${formatDuration(-line.slackElapsedS)}`,
      };
    }
    case 'earliestStart':
      return {
        ...base,
        text: line.holds
          ? `Earliest start of the order: ${at(line.atMs)}`
          : `Earliest start of the order: ${at(line.atMs)}: starts before it`,
      };
    case 'release': {
      const lead = line.leadTimeS > 0 ? `, lead ${formatDuration(line.leadTimeS)}` : ', lead 0';
      const point =
        line.sendAheadQuantity > 0
          ? `${line.sendAheadQuantity} pieces complete at ${at(line.pointMs)}${lead}`
          : `${line.fromRow} ends ${at(line.pointMs)}${lead}`;
      const head = `Release from ${line.fromRow}: ${at(line.atMs)} (${point})`;
      return {
        ...base,
        text:
          line.holds || line.beforeByS === undefined
            ? head
            : `${head}: starts ${formatDuration(line.beforeByS)} before its release`,
      };
    }
    case 'lastPiece':
      return {
        ...base,
        text: `Last piece: ends at or after ${at(line.atMs)} (${line.fromRow} end plus lead plus one cycle)`,
      };
    case 'hardLock':
      return { ...base, text: 'Hard lock: the row keeps its machine and its start' };
    case 'started':
      return { ...base, text: 'Started: the machine and the actual start stay' };
    case 'frozenWindow':
      return {
        ...base,
        text: `Frozen window until ${at(line.atMs)}: the row keeps its machine and order`,
      };
    case 'held':
      return { ...base, text: "Held: another planner's draft holds the order" };
    case 'allowedMachines': {
      const names = line.equipment.map((code) => text.machineName(code)).join(', ');
      return {
        ...base,
        text: line.holds
          ? `Allowed machines: ${names}`
          : `Allowed machines: ${names}; the row's machine is not allowed`,
      };
    }
    case 'oneJobAtATime': {
      const machine = text.machineName(line.equipment);
      return {
        ...base,
        text:
          line.overlaps !== undefined
            ? `One job at a time on ${machine}: overlaps ${line.overlaps}`
            : line.next === undefined
              ? `One job at a time on ${machine}: nothing follows in the loaded range`
              : `One job at a time on ${machine}: next is ${line.next.row} at ${at(line.next.setupStartMs)}`,
      };
    }
    case 'calendar': {
      const name = line.calendar ?? text.calendarName;
      return {
        ...base,
        text: line.holds
          ? `Calendar ${name}: all work in open time`
          : `Calendar ${name}: ${formatDuration(line.closedS ?? 0)} of work in closed time`,
      };
    }
    case 'notPlannable':
      return {
        ...base,
        text: `${text.machineName(line.equipment)} is not plannable: autoplan leaves the row where it is`,
      };
  }
}

/**
 * The binding constraint of a row as one sentence of the Float section and the hover card (plan
 * 18, What the timeline shows): "Starts at its release: 1001.10 end plus 1 h lead".
 */
export function bindingSentence(
  float: RowFloat,
  release: RowRelease | undefined,
  leadTimeS: number,
  sendAheadQuantity: number,
  text: TextContext,
): string {
  const { binding } = float;
  switch (binding.kind) {
    case 'started':
      return 'Started: the actual start is its earliest start';
    case 'hardLock':
      return 'Hard-locked: the row stays where it is';
    case 'frozenWindow':
      return 'Starts at the fence of the frozen window';
    case 'earliestStart':
      return 'Starts at the earliest start of the order';
    case 'release': {
      const from = binding.boundBy ?? release?.fromRow ?? '?';
      const lead = leadTimeS > 0 ? ` plus ${formatDuration(leadTimeS)} lead` : ', lead 0';
      return sendAheadQuantity > 0
        ? `Starts at its release: ${sendAheadQuantity} pieces of ${from} complete${lead}`
        : `Starts at its release: ${from} end${lead}`;
    }
    case 'machine':
      return `Starts when ${binding.boundBy ?? '?'} ends on ${binding.equipment ?? text.machineName(undefined)}`;
    case 'calendar':
      return `Starts at the next working instant after its release from ${binding.boundBy ?? '?'}`;
    case 'free':
      return 'Nothing stops an earlier start';
  }
}

/**
 * The analysis of a snapshot over a visible range: the float, release and constraint list of
 * every job order, the slack, late-by and chain of every order, and the workload of the production
 * days whose start lies in the range, all from the domain functions.
 */
export function analyzeGantt(base: GanttSnapshotBase, range: AnalysisRange): GanttAnalysis {
  const context = planContextOf(base, range);
  const text: TextContext = {
    timeZone: base.plant.timeZone,
    machineName: (code) =>
      base.equipment.find((machine) => machine.code === code)?.name ?? code ?? 'no machine',
    calendarName: base.calendar.name,
  };
  const orders: Record<string, OrderAnalysis> = {};
  const jobOrders: Record<string, JobOrderAnalysis> = {};
  for (const order of base.productionOrders) {
    const float = floatOf(order, context);
    const chain = criticalChain(order, context);
    orders[order.id] = {
      late: float.late,
      slackElapsedS: float.slackElapsedS,
      ...(float.lateByWorking !== undefined && { lateByWorking: float.lateByWorking }),
      ...(float.plannedStartMs !== undefined && { plannedStartMs: float.plannedStartMs }),
      ...(float.plannedEndMs !== undefined && { plannedEndMs: float.plannedEndMs }),
      ...(chain.rows.length > 0 && {
        chain: { rows: chain.rows, criticalRows: chain.criticalRows, continues: chain.continues },
      }),
    };
    for (const row of order.jobOrders) {
      const rowFloat = float.rows[row.id];
      const release = releaseOf(order, row.operationId, context);
      jobOrders[row.id] = {
        ...(rowFloat !== undefined && { float: rowFloat }),
        ...(release !== undefined && { release }),
        constraints: constraintsOf(order, row, context).map((line) => constraintText(line, text)),
      };
    }
  }
  // The production days whose start lies in the range: the day that began before the range, of
  // which the range holds the last hours, is not a bucket of this range.
  const dayStart = Temporal.PlainTime.from(base.plant.productionDayStart);
  const buckets = productionDayBuckets({
    timeZone: base.plant.timeZone,
    productionDayStart: base.plant.productionDayStart,
    fromMs: range.fromMs,
    toMs: range.toMs,
  }).filter(
    (bucket) =>
      Temporal.PlainDate.from(bucket.label).toZonedDateTime({
        timeZone: base.plant.timeZone,
        plainTime: dayStart,
      }).epochMilliseconds >= range.fromMs,
  );
  return { jobOrders, orders, workload: workload(context, buckets) };
}

/** The order of a job order in a snapshot. */
export function orderOfRow(
  orders: readonly GanttOrder[],
  jobOrderId: string,
): GanttOrder | undefined {
  return orders.find((order) => order.jobOrders.some((row) => row.id === jobOrderId));
}
