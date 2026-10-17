// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { availabilityOf, weeklyCalendar } from '../calendar/calendar.ts';
import type { Windows } from '../calendar/windows.ts';
import type { PlanContext, PlanOrder } from '../plan-context.ts';
import { type GanttFixture, g1 } from './gantt.ts';

/** The end of the loaded horizon of the fixture, three weeks after its week. */
export const g1HorizonEndMs = Date.UTC(2026, 10, 29, 23);

/** The order id of an order number in the fixture, where the server sends a uuid. */
export function g1OrderId(number: string): string {
  return `po-${number}`;
}

/** The fixture G1 as a plan context: its orders in epoch milliseconds over the A1 calendar. */
export function g1PlanContext(fixture: GanttFixture = g1): PlanContext {
  const calendar = weeklyCalendar({ timeZone: fixture.plant.timeZone, ...fixture.calendar });
  const nowMs = Date.parse(fixture.now.instant);
  const availability: Record<string, Windows> = {};
  for (const machine of fixture.equipment) {
    availability[machine.code] = availabilityOf(calendar, machine.code, nowMs, g1HorizonEndMs);
  }
  const orders: PlanOrder[] = fixture.productionOrders.map((order) => ({
    id: g1OrderId(order.number),
    number: order.number,
    deadlineMs: Date.parse(order.deadlineInstant.instant),
    priority: order.priority,
    operations: order.operations.map((operation) => ({
      id: operation.displayNumber,
      displayNumber: operation.displayNumber,
      sequence: operation.sequence,
      quantity: operation.quantity,
      rates: operation.rates,
      leadTimeS: operation.leadTimeS,
      sendAheadQuantity: operation.sendAheadQuantity,
      isLocked: operation.isLocked,
      allowedEquipment: operation.allowedEquipment,
    })),
    jobOrders: order.jobOrders.map((row) => ({
      id: row.id,
      operationId: row.productionOrderOperation,
      displayNumber: row.productionOrderOperation,
      equipment: row.equipment,
      quantity: row.quantity,
      status: row.status,
      placement: {
        setupStartMs: Date.parse(row.setupStartAt),
        runStartMs: Date.parse(row.runStartAt),
        endMs: Date.parse(row.endAt),
      },
      plannedSetupS: row.plannedSetupS,
      plannedRunS: row.plannedRunS,
      rates: row.rates,
    })),
  }));
  return {
    nowMs,
    fenceMs: Date.parse(fixture.fence.instant),
    settings: {
      frozenHours: fixture.settings.frozenHours,
      leadTimeBasis: fixture.settings.leadTimeBasis,
      retoolOverlapsLeadTime: fixture.settings.retoolOverlapsLeadTime,
    },
    availability,
    orders,
  };
}
