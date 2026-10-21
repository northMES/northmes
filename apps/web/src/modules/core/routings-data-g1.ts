// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  type GanttFixture,
  type GanttInventoryFixture,
  type GanttMasterDataFixture,
  type GanttPagesFixture,
  g1,
  g1Inventory,
  g1MasterData,
  g1Pages,
} from '@northmes/planning-domain';
import {
  type Routing,
  RoutingsForbidden,
  type RoutingsSnapshot,
  type RoutingsSource,
} from './routings-data.ts';

/**
 * The routings of the fixture G1: each article's operations as G1's first order of the article
 * copied them (rates, lead time, send-ahead), named by the pages fixture's routing, with the
 * machines, tools, how the cycle time was entered, the OEE target and Keep NorthMES values from the
 * master data fixture, and the materials from the inventory fixture.
 */
export function g1RoutingsSnapshot(
  fixture: GanttFixture = g1,
  pages: GanttPagesFixture = g1Pages,
  inventory: GanttInventoryFixture = g1Inventory,
  masterData: GanttMasterDataFixture = g1MasterData,
): RoutingsSnapshot {
  const machineNames = new Map(
    [...fixture.equipment, ...pages.equipment].map((machine) => [machine.code, machine.name]),
  );
  const articles = new Map(inventory.articles.map((article) => [article.name, article]));
  const toolNames = new Map(masterData.tools.map((tool) => [tool.code, tool.name]));
  const routings: Routing[] = masterData.routings.flatMap((detail) => {
    const orders = fixture.productionOrders.filter((order) => order.article === detail.article);
    const first = orders[0];
    const article = articles.get(detail.article);
    if (first === undefined || article === undefined) return [];
    const named = pages.routings.find((routing) => routing.article === detail.article);
    return [
      {
        articleNumber: article.number,
        articleName: article.name,
        erpVersion: detail.erpVersion,
        importedAtMs: Date.parse(detail.importedAt.instant),
        openOrders: orders.map((order) => ({ number: order.number, quantity: order.quantity })),
        operations: detail.operations.flatMap((operation) => {
          const base = first.operations.find((each) => each.sequence === operation.sequence);
          if (base === undefined) return [];
          return [
            {
              sequence: operation.sequence,
              name:
                named?.operations.find((each) => each.sequence === operation.sequence)?.name ??
                base.name,
              cycleSeconds: base.rates.cycleSeconds,
              cycleEntered: operation.cycleEntered,
              retoolSeconds: base.rates.retoolSeconds,
              fixedSeconds: base.rates.fixedSeconds,
              oeeTarget: operation.oeeTarget,
              piecesPerCycle: base.rates.piecesPerCycle,
              cyclesPerPiece: base.rates.cyclesPerPiece,
              leadTimeS: base.leadTimeS,
              sendAheadQuantity: base.sendAheadQuantity,
              ...(operation.kept !== undefined && {
                kept: {
                  sinceMs: Date.parse(operation.kept.since.instant),
                  by: operation.kept.by,
                  reason: operation.kept.reason,
                  erpLeadTimeS: operation.kept.erpLeadTimeSeconds,
                },
              }),
              machines: operation.machines.map(({ addedBy, ...machine }) => ({
                ...machine,
                name: machineNames.get(machine.code) ?? machine.code,
                ...(addedBy !== undefined && { addedBy }),
              })),
              tools: operation.tools.map((tool) => ({
                ...tool,
                name: toolNames.get(tool.code) ?? tool.code,
              })),
              materials: inventory.operationMaterials
                .filter(
                  (material) =>
                    material.article === detail.article && material.sequence === operation.sequence,
                )
                .map((material) => {
                  const consumed = inventory.articles.find(
                    (each) => each.number === material.material,
                  );
                  return {
                    number: material.material,
                    name: consumed?.name ?? material.material,
                    unit: consumed?.unit ?? '',
                    perPiece: material.perPiece,
                    warehouse: material.warehouse,
                  };
                }),
            },
          ];
        }),
      },
    ];
  });
  return {
    fixture: fixture.id,
    plant: {
      slug: fixture.plant.slug,
      name:
        pages.plants.find((plant) => plant.slug === fixture.plant.slug)?.name ?? fixture.plant.slug,
      timeZone: fixture.plant.timeZone,
    },
    planningFactorSource:
      fixture.settings.planningFactorSource === 'oeeTarget' ? 'oeeTarget' : 'none',
    routings,
  };
}

/** A load that never answers: the loading state while a page waits for the server (RO5). */
const never = new Promise<RoutingsSnapshot>(() => {});

/**
 * The mock data source of the routing pages (design #729): the fixture, or the page state the
 * URL's preview asks for, so the product owner opens RO5 to RO8 on mock data.
 */
export const g1RoutingsSource: RoutingsSource = {
  load: async ({ preview }) => {
    switch (preview) {
      case 'loading':
        return never;
      case 'empty':
        return { ...g1RoutingsSnapshot(), routings: [] };
      case 'error':
        throw new Error('The routings could not be loaded');
      case 'forbidden':
        throw new RoutingsForbidden();
      default:
        return g1RoutingsSnapshot();
    }
  },
};
