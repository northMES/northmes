// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  availabilityOf,
  type GanttFixture,
  type GanttPagesFixture,
  g1,
  g1Pages,
  resolveWallClock,
} from '@northmes/planning-domain';
import { Temporal } from 'temporal-polyfill';
import { analyzeGantt, placementWithSegments, workingCalendarOf } from './gantt-analysis.ts';
import type {
  GanttDataSource,
  GanttJobOrder,
  GanttOperation,
  GanttOrder,
  GanttSettings,
  GanttSnapshot,
  HistoryEntry,
  OrderOrigin,
} from './gantt-data.ts';
import { type EffectivePlanningRules, ganttSettingsWith } from './planning-rules.ts';

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

/**
 * Where an order came from: the import or the creator and the routing version the pages fixture
 * adds; the owner stays G1's own (#711). An order the pages fixture does not name has no origin.
 */
function originOf(order: FixtureOrder, pages: GanttPagesFixture): OrderOrigin | undefined {
  const origin = pages.orders[order.number];
  if (origin === undefined) return undefined;
  return {
    ...(origin.importedAt !== undefined && { importedAtMs: ms(origin.importedAt.instant) }),
    ...(origin.createdAt !== undefined && { createdAtMs: ms(origin.createdAt.instant) }),
    ...(origin.createdBy !== undefined && { createdBy: origin.createdBy }),
    routingVersion: origin.routingVersion,
  };
}

/**
 * An order's deadline instant: its own time when the source gave one, else the plant's deadline
 * rule on its date (ADR 0027): 00:00 plant time at the start of the day, or the end of the shift.
 */
function deadlineMsOf(order: FixtureOrder, settings: GanttSettings, timeZone: string): number {
  const time =
    order.deadlineTime ??
    (settings.deadlineRule === 'startOfDay' ? '00:00' : settings.shiftEndForDeadline);
  // ADR 0024's clamp rule: a time in the spring gap is the first instant after it.
  return resolveWallClock(
    timeZone,
    Temporal.PlainDate.from(order.deadlineDate),
    Temporal.PlainTime.from(time),
  );
}

function orderOf(
  order: FixtureOrder,
  windowsOf: (equipment: string) => ReturnType<typeof availabilityOf>,
  pages: GanttPagesFixture,
  deadlineMs: number,
): GanttOrder {
  return {
    id: orderIdOf(order.number),
    number: order.number,
    article: order.article,
    quantity: order.quantity,
    deadlineDate: order.deadlineDate,
    deadlineMs,
    priority: order.priority,
    color: order.color,
    status: order.status,
    owner: order.owner,
    operations: order.operations.map(operationOf),
    jobOrders: order.jobOrders.map((row) => jobOrderOf(order, row, windowsOf)),
    ...withOrigin(originOf(order, pages)),
    ...withExternalData(pages.orders[order.number]?.externalData),
  };
}

/** The ERP's free fields of an order, left out when it has none (#762). */
function withExternalData(
  entries: readonly { readonly key: string; readonly value: string }[] | undefined,
): { readonly externalData?: readonly { readonly key: string; readonly value: string }[] } {
  return entries === undefined || entries.length === 0 ? {} : { externalData: entries };
}

/** The origin key of an order, left out when there is none. */
function withOrigin(origin: OrderOrigin | undefined): { readonly origin?: OrderOrigin } {
  return origin === undefined ? {} : { origin };
}

/**
 * What the planning pages show beside the Gantt, from the pages fixture: the ERP connection, the
 * company's plants, the customers and their lines (each line names its production order by the
 * snapshot's id), the routings and the history of each order, newest first.
 */
function pagesOf(fixture: GanttFixture, pages: GanttPagesFixture) {
  const numbers = new Set(fixture.productionOrders.map((order) => order.number));
  const history: Record<string, HistoryEntry[]> = {};
  for (const [number, entries] of Object.entries(pages.history)) {
    history[orderIdOf(number)] = entries
      .map((entry, index) => ({
        id: `${number}-${index}`,
        atMs: ms(entry.at.instant),
        by: entry.by,
        surface: entry.surface,
        ...(entry.reason !== null && { reason: entry.reason }),
        summary: entry.summary,
        changes: entry.changes,
      }))
      .sort((a, b) => b.atMs - a.atMs);
  }
  return {
    erp: { name: pages.erp.connectionName, importedAtMs: ms(pages.erp.importedAt.instant) },
    plants: pages.plants,
    customers: pages.customers,
    customerOrderLines: pages.customerOrderLines.map((line) => ({
      id: `${line.customerOrder}-${line.line}`,
      customerOrder: line.customerOrder,
      customersReference: line.customersReference,
      customerCode: line.customer,
      line: line.line,
      article: line.article,
      quantity: line.quantity,
      wantedDate: line.wantedDate,
      deliveringPlant: line.deliveringPlant,
      // A line whose order the snapshot lacks is not supplied, as a line without an order is.
      ...(line.productionOrder !== null &&
        numbers.has(line.productionOrder) && {
          productionOrderId: orderIdOf(line.productionOrder),
        }),
    })),
    routings: pages.routings,
    history,
    moduleFields: pages.moduleFields,
  };
}

/**
 * The snapshot of the fixture G1 over a visible range, with its analysis from the domain
 * functions (plan 18, phase 2): the placements come from the fixture's job orders, everything
 * else from floatOf, criticalChain, releaseOf, constraintsOf and workload over them. With a
 * plant's planning rules as saved (#766), the settings, the frozen window and the deadlines of
 * date-only orders follow them; without, they are the fixture's own.
 */
export function g1Snapshot(
  fixture: GanttFixture = g1,
  range = g1Week,
  pages: GanttPagesFixture = g1Pages,
  rules?: EffectivePlanningRules,
): GanttSnapshot {
  const fixtureSettings: GanttSettings = {
    deadlineRule: fixture.settings.deadlineRule,
    shiftEndForDeadline: fixture.settings.shiftEndForDeadline,
    frozenHours: fixture.settings.frozenHours,
    leadTimeBasis: fixture.settings.leadTimeBasis,
    retoolOverlapsLeadTime: fixture.settings.retoolOverlapsLeadTime,
  };
  const settings =
    rules === undefined ? fixtureSettings : ganttSettingsWith(fixtureSettings, rules);
  const nowMs = ms(fixture.now.instant);
  const fenceMs =
    rules === undefined ? ms(fixture.fence.instant) : nowMs + settings.frozenHours * 3_600_000;
  const deadlineOf = (order: FixtureOrder) =>
    rules === undefined
      ? ms(order.deadlineInstant.instant)
      : deadlineMsOf(order, settings, fixture.plant.timeZone);
  const calendar = workingCalendarOf(fixture.calendar, fixture.plant.timeZone);
  // The windows cover the fixture's placements and deadlines as well as the asked range, so a load
  // of a later week still lays every placement over the calendar it was planned on.
  const day = 86_400_000;
  let fromMs = Math.min(range.fromMs, ms(fixture.now.instant));
  let toMs = Math.max(range.toMs, ms(fixture.fence.instant));
  for (const order of fixture.productionOrders) {
    toMs = Math.max(toMs, ms(order.deadlineInstant.instant));
    for (const row of order.jobOrders) {
      fromMs = Math.min(fromMs, ms(row.setupStartAt));
      toMs = Math.max(toMs, ms(row.endAt));
    }
  }
  const horizon = { fromMs: fromMs - 7 * day, toMs: toMs + 28 * day };
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
    settings,
    nowMs,
    fenceMs,
    calendar: {
      name: fixture.calendar.name,
      weekdays: fixture.calendar.weekdays,
      shift: fixture.calendar.shift,
      breaks: fixture.calendar.breaks,
      workingSecondsPerDay: fixture.calendar.workingSecondsPerDay,
      deviations: fixture.calendar.deviations,
    },
    equipmentGroups: fixture.equipmentGroups.map(({ code, name, color }) => ({
      code,
      name,
      color,
    })),
    equipment: fixture.equipment,
    productionOrders: fixture.productionOrders.map((order) =>
      orderOf(order, windowsOf, pages, deadlineOf(order)),
    ),
    ...pagesOf(fixture, pages),
  };
  return { ...base, analysis: analyzeGantt(base, range) };
}

/**
 * The mock data source of phase 1 (plan 18): every load answers with the fixture G1 analysed over
 * the asked range, so the product owner evaluates the Gantt on known data before a backend exists.
 * The screen shows "Showing fixture G1" while it is in use.
 */
export const g1DataSource: GanttDataSource = {
  load: async ({ from, to, rules }) =>
    g1Snapshot(g1, { fromMs: Date.parse(from), toMs: Date.parse(to) }, g1Pages, rules),
};
