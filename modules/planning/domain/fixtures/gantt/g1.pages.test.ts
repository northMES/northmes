// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1 } from '../../src/fixtures/gantt.ts';
import { g1Pages } from '../../src/fixtures/gantt-pages.ts';

/**
 * The pages fixture beside G1: what the planning pages show that G1 does not hold. The test guards
 * that it names only things G1 or it defines, so a page never meets a dangling reference.
 */
describe('the pages fixture beside G1 (plan 18, the planning pages)', () => {
  const machines = new Set([
    ...g1.equipment.map((machine) => machine.code),
    ...g1Pages.equipment.map((machine) => machine.code),
  ]);
  const groups = new Set([
    ...g1.equipmentGroups.map((group) => group.code),
    ...g1Pages.equipmentGroups.map((group) => group.code),
  ]);
  const customers = new Set(g1Pages.customers.map((customer) => customer.code));
  const orderNumbers = new Set(g1.productionOrders.map((order) => order.number));

  it('names a customer of its own on every customer order line', () => {
    for (const line of g1Pages.customerOrderLines) {
      expect(customers.has(line.customer), `${line.customerOrder} line ${line.line}`).toBe(true);
    }
  });

  it("#728 delivers every customer order line from a plant it names, G1's plant among them", () => {
    const plants = new Set(g1Pages.plants.map((plant) => plant.slug));
    expect(plants.has(g1.plant.slug)).toBe(true);
    for (const line of g1Pages.customerOrderLines) {
      expect(plants.has(line.deliveringPlant), `${line.customerOrder} line ${line.line}`).toBe(
        true,
      );
    }
  });

  it('gives every order of G1 an origin, and an origin to no order that neither G1 nor a line names', () => {
    for (const number of orderNumbers) {
      expect(g1Pages.orders, number).toHaveProperty(number);
    }
    const supplied = new Set(
      g1Pages.customerOrderLines.flatMap((line) =>
        line.productionOrder === null ? [] : [line.productionOrder],
      ),
    );
    for (const number of Object.keys(g1Pages.orders)) {
      expect(orderNumbers.has(number) || supplied.has(number), number).toBe(true);
    }
  });

  it('agrees with G1 on who owns each order', () => {
    for (const order of g1.productionOrders) {
      expect(g1Pages.orders[order.number]?.owner, order.number).toBe(order.owner);
    }
  });

  it('marks an imported order with its import and a NorthMES order with its creator', () => {
    for (const [number, origin] of Object.entries(g1Pages.orders)) {
      if (origin.owner === 'erp') {
        expect(origin.importedAt, number).toBeDefined();
      } else {
        expect(origin.createdAt, number).toBeDefined();
        expect(origin.createdBy, number).toBeDefined();
      }
    }
  });

  it('has a routing for every article of G1, whose operations name machines of the plant', () => {
    const articles = new Set(g1Pages.routings.map((routing) => routing.article));
    for (const order of g1.productionOrders) {
      expect(articles.has(order.article), order.number).toBe(true);
    }
    for (const routing of g1Pages.routings) {
      for (const operation of routing.operations) {
        for (const code of operation.allowedEquipment) {
          expect(machines.has(code), `${routing.article} ${operation.sequence}`).toBe(true);
        }
      }
    }
  });

  it('puts every machine in a group of the plant and names an owner for each of G1 machines', () => {
    for (const machine of g1Pages.equipment) {
      expect(groups.has(machine.group), machine.code).toBe(true);
    }
    for (const machine of g1.equipment) {
      expect(g1Pages.equipmentOwners, machine.code).toHaveProperty(machine.code);
    }
  });

  it('#762 gives ERP data to imported orders only, each key once per order', () => {
    for (const [number, origin] of Object.entries(g1Pages.orders)) {
      const keys = (origin.externalData ?? []).map((entry) => entry.key);
      if (origin.owner === 'northmes') expect(keys, number).toEqual([]);
      expect(new Set(keys).size, number).toBe(keys.length);
    }
    const withData = Object.values(g1Pages.orders).filter(
      (origin) => (origin.externalData ?? []).length > 0,
    );
    expect(withData.length).toBeGreaterThan(1);
  });

  it('#762 fills its module fields on job orders of G1 only', () => {
    const jobOrders = new Set(
      g1.productionOrders.flatMap((order) => order.jobOrders.map((row) => row.id)),
    );
    expect(g1Pages.moduleFields.length).toBeGreaterThan(0);
    for (const field of g1Pages.moduleFields) {
      for (const id of Object.keys(field.values)) {
        expect(jobOrders.has(id), `${field.id} ${id}`).toBe(true);
      }
    }
  });

  it("#762 names the company's block fields and hover fields, at most 4 block fields", () => {
    const { block, hover } = g1Pages.boardFields.company;
    expect(block.length).toBeGreaterThan(0);
    expect(block.length).toBeLessThanOrEqual(4);
    expect(hover.length).toBeGreaterThan(0);
  });

  it('names machines of the plant in its deviations, which G1 itself keeps empty', () => {
    expect(g1.calendar.deviations).toEqual([]);
    expect(g1Pages.calendar.deviations).toHaveLength(2);
    for (const deviation of g1Pages.calendar.deviations) {
      for (const code of deviation.equipment ?? []) {
        expect(machines.has(code), deviation.reason).toBe(true);
      }
    }
  });

  it('puts each of its machines on no calendar, the calendar of G1 or a calendar of its own', () => {
    const calendars = new Set([g1.calendar.name, ...g1Pages.calendars.map((each) => each.name)]);
    for (const machine of g1Pages.equipment) {
      expect(machine.calendar === null || calendars.has(machine.calendar), machine.code).toBe(true);
    }
  });

  it('gives each shift of its calendars the working time of its span minus its breaks (#770)', () => {
    const minutes = (clock: string) => {
      const [hours = 0, rest = 0] = clock.split(':').map(Number);
      return hours * 60 + rest;
    };
    /** The minutes from start to end, across midnight when the end is not later. */
    const span = (start: string, end: string) =>
      (minutes(end) - minutes(start) + 24 * 60) % (24 * 60) || 24 * 60;
    for (const calendar of g1Pages.calendars) {
      for (const shift of calendar.shifts) {
        const breaks = shift.breaks.reduce((sum, each) => sum + span(each.start, each.end), 0);
        expect(shift.workingSeconds, `${calendar.name} ${shift.name}`).toBe(
          (span(shift.start, shift.end) - breaks) * 60,
        );
      }
    }
    expect(g1Pages.calendars.map((each) => each.name)).toEqual(['B3']);
  });
});
