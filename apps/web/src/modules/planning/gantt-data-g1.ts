// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { availabilityOf, type GanttFixture, g1 } from '@northmes/planning-domain';
import { analyzeGantt, placementWithSegments, workingCalendarOf } from './gantt-analysis.ts';
import type {
  GanttDataSource,
  GanttJobOrder,
  GanttOperation,
  GanttOrder,
  GanttSnapshot,
} from './gantt-data.ts';

/** An ISO instant as epoch milliseconds: the one place a snapshot's instants are parsed. */
function ms(instant: string): number {
  return Date.parse(instant);
}

/** The order id of an order number in the fixture, where the server sends a uuid. */
function orderIdOf(number: string): string {
  return `po-${number}`;
}

/** Week 45 of 2026 in plant time, the week the fixture is written for. */
export const g1Week = {
  fromMs: Date.UTC(2026, 10, 1, 23),
  toMs: Date.UTC(2026, 10, 8, 23),
};

type FixtureOrder = GanttFixture['productionOrders'][number];
type FixtureJobOrder = FixtureOrder['jobOrders'][number];

function operationOf(operation: FixtureOrder['operations'][number]): GanttOperation {
  return {
    id: operation.displayNumber,
    displayNumber: operation.displayNumber,
    sequence: operation.sequence,
    name: operation.name,
    quantity: operation.quantity,
    rates: operation.rates,
    leadTimeS: operation.leadTimeS,
    sendAheadQuantity: operation.sendAheadQuantity,
    isLocked: operation.isLocked,
    allowedEquipment: operation.allowedEquipment,
  };
}

/** A job order with its placement laid over its machine's availability for its working segments. */
function jobOrderOf(
  order: FixtureOrder,
  row: FixtureJobOrder,
  windowsOf: (equipment: string) => ReturnType<typeof availabilityOf>,
): GanttJobOrder {
  return {
    id: row.id,
    orderId: orderIdOf(order.number),
    operationId: row.productionOrderOperation,
    displayNumber: row.productionOrderOperation,
    equipment: row.equipment,
    quantity: row.quantity,
    status: row.status,
    placement: placementWithSegments(
      row,
      { setupStartMs: ms(row.setupStartAt), runStartMs: ms(row.runStartAt), endMs: ms(row.endAt) },
      windowsOf(row.equipment),
    ),
    plannedSetupS: row.plannedSetupS,
    plannedRunS: row.plannedRunS,
    rates: row.rates,
  };
}

function orderOf(
  order: FixtureOrder,
  windowsOf: (equipment: string) => ReturnType<typeof availabilityOf>,
): GanttOrder {
  return {
    id: orderIdOf(order.number),
    number: order.number,
    article: order.article,
    quantity: order.quantity,
    deadlineDate: order.deadlineDate,
    deadlineMs: ms(order.deadlineInstant.instant),
    priority: order.priority,
    color: order.color,
    status: order.status,
    operations: order.operations.map(operationOf),
    jobOrders: order.jobOrders.map((row) => jobOrderOf(order, row, windowsOf)),
  };
}

/**
 * The snapshot of the fixture G1 over a visible range, with its analysis from the domain
 * functions (plan 18, phase 2): the placements come from the fixture's job orders, everything
 * else from floatOf, criticalChain, releaseOf, constraintsOf and workload over them.
 */
export function g1Snapshot(fixture: GanttFixture = g1, range = g1Week): GanttSnapshot {
  const calendar = workingCalendarOf(fixture.calendar, fixture.plant.timeZone);
  const horizon = { fromMs: range.fromMs - 7 * 86_400_000, toMs: range.toMs + 28 * 86_400_000 };
  const windows = new Map<string, ReturnType<typeof availabilityOf>>();
  const windowsOf = (equipment: string) => {
    const known = windows.get(equipment);
    if (known !== undefined) return known;
    const expanded = availabilityOf(calendar, equipment, horizon.fromMs, horizon.toMs);
    windows.set(equipment, expanded);
    return expanded;
  };
  const base: Omit<GanttSnapshot, 'analysis'> = {
    fixture: fixture.id,
    plant: fixture.plant,
    settings: {
      deadlineRule: fixture.settings.deadlineRule,
      shiftEndForDeadline: fixture.settings.shiftEndForDeadline,
      frozenHours: fixture.settings.frozenHours,
      leadTimeBasis: fixture.settings.leadTimeBasis,
      retoolOverlapsLeadTime: fixture.settings.retoolOverlapsLeadTime,
    },
    nowMs: ms(fixture.now.instant),
    fenceMs: ms(fixture.fence.instant),
    calendar: {
      name: fixture.calendar.name,
      weekdays: fixture.calendar.weekdays,
      shift: fixture.calendar.shift,
      breaks: fixture.calendar.breaks,
      workingSecondsPerDay: fixture.calendar.workingSecondsPerDay,
      deviations: fixture.calendar.deviations,
    },
    equipmentGroups: fixture.equipmentGroups.map(({ code, name }) => ({ code, name })),
    equipment: fixture.equipment,
    productionOrders: fixture.productionOrders.map((order) => orderOf(order, windowsOf)),
  };
  return { ...base, analysis: analyzeGantt(base, range) };
}

/**
 * The mock data source of phase 1 (plan 18): every load answers with the fixture G1 analysed over
 * the asked range, so the product owner evaluates the Gantt on known data before a backend exists.
 * The screen shows "Showing fixture G1" while it is in use.
 */
export const g1DataSource: GanttDataSource = {
  load: async ({ from, to }) => g1Snapshot(g1, { fromMs: Date.parse(from), toMs: Date.parse(to) }),
};
