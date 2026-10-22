// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import pagesJson from '../../fixtures/gantt/g1.pages.json' with { type: 'json' };
import { calendarDeviation, clock, timePoint } from './gantt.ts';

/**
 * What the planning pages of the product owner round show beside the fixture G1: the ERP
 * connection, the customers and their order lines, where each order came from, the routings, the
 * history of an order, a machine that is not on the board and the calendar deviations the plant
 * admin added. The mock data sources in apps/web merge it with G1; nothing here changes what the
 * Gantt's analysis reads, so G1's expected values stay as they are.
 */

/** Who owns a record's master fields: the ERP through the connector, or NorthMES itself. */
export const recordOwner = z.enum(['erp', 'northmes']);

export const customer = z.object({ code: z.string(), name: z.string() });

/** One customer order line, and the production order that supplies it, if any. */
export const customerOrderLine = z.object({
  customerOrder: z.string(),
  /** The customer's own order number, as the ERP holds it. */
  customersReference: z.string(),
  /** The customer's code. */
  customer: z.string(),
  line: z.number().int().positive(),
  article: z.string(),
  quantity: z.number().int().positive(),
  wantedDate: z.iso.date(),
  /** The number of the production order that supplies the line; null while there is none. */
  productionOrder: z.string().nullable(),
});

/** Where an order came from: the ERP, with the import that brought it, or NorthMES, with its creator. */
export const orderOrigin = z.object({
  owner: recordOwner,
  importedAt: timePoint.optional(),
  createdAt: timePoint.optional(),
  createdBy: z.string().optional(),
  /** The version of the article's routing the order's operations were copied from. */
  routingVersion: z.number().int().positive(),
});

export const routing = z.object({
  article: z.string(),
  version: z.number().int().positive(),
  operations: z
    .array(
      z.object({
        sequence: z.number().int().positive(),
        name: z.string(),
        allowedEquipment: z.array(z.string()).nonempty(),
      }),
    )
    .nonempty(),
});

/** One entry of an order's history (design ui-222, DE3): who changed what, where and why. */
export const historyEntry = z.object({
  at: timePoint,
  by: z.string(),
  surface: z.string(),
  reason: z.string().nullable(),
  summary: z.string(),
  changes: z.array(z.object({ field: z.string(), before: z.string(), after: z.string() })),
});

/** A deviation as the plant admin entered it: the calendar's shape plus who added it and when. */
export const enteredDeviation = calendarDeviation.extend({
  addedBy: z.string(),
  addedAt: timePoint,
});

export const ganttPagesFixture = z.object({
  id: z.literal('G1-pages'),
  description: z.string(),
  erp: z.object({ connectionName: z.string(), importedAt: timePoint }),
  customers: z.array(customer).nonempty(),
  customerOrderLines: z.array(customerOrderLine).nonempty(),
  /** By order number. */
  orders: z.record(z.string(), orderOrigin),
  routings: z.array(routing).nonempty(),
  /** By order number. */
  history: z.record(z.string(), z.array(historyEntry)),
  /** The equipment groups beside G1's. */
  equipmentGroups: z.array(z.object({ code: z.string(), name: z.string(), color: z.string() })),
  /** The machines beside G1's; one without a calendar is not on the board. */
  equipment: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      group: z.string(),
      isPlannable: z.boolean(),
      calendar: z.string().nullable(),
      owner: recordOwner,
    }),
  ),
  /** The owner of each of G1's machines, by code. */
  equipmentOwners: z.record(z.string(), recordOwner),
  calendar: z.object({
    effectiveFrom: z.iso.date(),
    cycleWeeks: z.number().int().positive(),
    shiftName: z.string(),
    deviations: z.array(enteredDeviation),
  }),
  /** The calendars beside G1's A1, which only the plant settings pages show (#770). */
  calendars: z.array(
    z.object({
      name: z.string(),
      effectiveFrom: z.iso.date(),
      cycleWeeks: z.number().int().positive(),
      /** In the version's order. An end at or before the start is on the next date. */
      shifts: z
        .array(
          z.object({
            name: z.string(),
            weekdays: z.array(z.number().int().min(1).max(7)),
            start: clock,
            end: clock,
            breaks: z.array(z.object({ start: clock, end: clock })),
            workingSeconds: z.number().int().positive(),
          }),
        )
        .nonempty(),
      deviations: z.array(enteredDeviation),
    }),
  ),
});

export type GanttPagesFixture = z.infer<typeof ganttPagesFixture>;

/** The pages fixture beside G1, parsed once. */
export const g1Pages: GanttPagesFixture = ganttPagesFixture.parse(pagesJson);
