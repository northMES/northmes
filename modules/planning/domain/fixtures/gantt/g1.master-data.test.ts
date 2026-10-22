// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1 } from '../../src/fixtures/gantt.ts';
import { g1MasterData } from '../../src/fixtures/gantt-master-data.ts';
import { g1Pages } from '../../src/fixtures/gantt-pages.ts';

/**
 * The master data fixture beside G1 (design #729): what the routing, tools and equipment group
 * pages add to G1's operations. The test guards that it agrees with G1 and the pages fixture on
 * every operation, cycle time and allowed machine. The machine overrides are the master data's
 * own: G1's job orders do not apply them yet when a planner moves one.
 */
describe('the master data fixture beside G1 (design #729)', () => {
  const tools = new Set(g1MasterData.tools.map((tool) => tool.code));

  it('#729 details every routing operation of the pages fixture, with the same allowed machines', () => {
    for (const routing of g1Pages.routings) {
      const detail = g1MasterData.routings.find((each) => each.article === routing.article);
      expect(detail?.erpVersion, routing.article).toBe(routing.version);
      for (const operation of routing.operations) {
        const machines = detail?.operations
          .find((each) => each.sequence === operation.sequence)
          ?.machines.map((machine) => machine.code);
        expect(machines, `${routing.article} ${operation.sequence}`).toEqual(
          operation.allowedEquipment,
        );
      }
    }
  });

  it('#729 gives each operation one default machine and names known tools', () => {
    for (const routing of g1MasterData.routings) {
      for (const operation of routing.operations) {
        const name = `${routing.article} ${operation.sequence}`;
        expect(
          operation.machines.filter((machine) => machine.default),
          name,
        ).toHaveLength(1);
        for (const tool of operation.tools) expect(tools.has(tool.code), name).toBe(true);
      }
    }
  });

  it("#729 keeps an operation's lead time in NorthMES only where G1 has the planner's value", () => {
    const leadTimes = new Map(
      g1.productionOrders.flatMap((order) =>
        order.operations.map((operation) => [
          `${order.article} ${operation.sequence}`,
          operation.leadTimeS,
        ]),
      ),
    );
    for (const routing of g1MasterData.routings) {
      for (const operation of routing.operations) {
        if (operation.kept === undefined) continue;
        expect(leadTimes.get(`${routing.article} ${operation.sequence}`)).not.toBe(
          operation.kept.erpLeadTimeSeconds,
        );
      }
    }
  });

  it("#729 enters each cycle time as G1's own, in seconds or in pieces per hour", () => {
    for (const routing of g1MasterData.routings) {
      const order = g1.productionOrders.find((each) => each.article === routing.article);
      for (const operation of routing.operations) {
        const rates = order?.operations.find((each) => each.sequence === operation.sequence)?.rates;
        const name = `${routing.article} ${operation.sequence}`;
        expect(rates, name).toBeDefined();
        const seconds =
          operation.cycleEntered.unit === 'seconds'
            ? operation.cycleEntered.value
            : (3600 / operation.cycleEntered.value) * (rates?.piecesPerCycle ?? 1);
        expect(seconds, name).toBe(rates?.cycleSeconds);
      }
    }
  });

  it('#729 details no routing and no operation that G1 and the pages fixture lack', () => {
    for (const routing of g1MasterData.routings) {
      const named = g1Pages.routings.find((each) => each.article === routing.article);
      expect(named, routing.article).toBeDefined();
      for (const operation of routing.operations) {
        expect(
          named?.operations.some((each) => each.sequence === operation.sequence),
          `${routing.article} ${operation.sequence}`,
        ).toBe(true);
      }
    }
  });

  it('#729 details every equipment group of G1 and the pages fixture, naming and coloring only the ones they lack', () => {
    const known = new Set(
      [...g1.equipmentGroups, ...g1Pages.equipmentGroups].map((group) => group.code),
    );
    for (const code of known) {
      expect(
        g1MasterData.equipmentGroups.some((group) => group.code === code),
        code,
      ).toBe(true);
    }
    for (const group of g1MasterData.equipmentGroups) {
      const own = group.name !== undefined && group.color !== undefined;
      expect(own, group.code).toBe(!known.has(group.code));
    }
  });

  it('#729 gives a group that took its color from the palette the first color no other group used', () => {
    // Each group in turn: a palette group takes the first color no group before it used.
    const colors = [...g1.equipmentGroups, ...g1Pages.equipmentGroups].map((group) => group.color);
    for (const group of g1MasterData.equipmentGroups.filter(
      (each) => each.colorFrom === 'palette',
    )) {
      const first = Array.from({ length: 20 }, (_, index) => `palette-${index + 1}`).find(
        (color) => !colors.includes(color),
      );
      expect(group.color, group.code).toBe(first);
      colors.push(group.color ?? '');
    }
  });
});
