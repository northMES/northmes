// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  type GanttInventoryFixture,
  type GanttPagesFixture,
  g1,
  g1Inventory,
  g1Pages,
} from '@northmes/planning-domain';
import {
  WarehousesForbidden,
  type WarehousesSnapshot,
  type WarehousesSource,
} from './warehouses-data.ts';

/**
 * The warehouses of the company in the inventory fixture beside G1: each with the plant it maps to,
 * named as the pages fixture names the plants, and the count of its stock rows.
 */
export function g1WarehousesSnapshot(
  inventory: GanttInventoryFixture = g1Inventory,
  pages: GanttPagesFixture = g1Pages,
): WarehousesSnapshot {
  const plants = pages.plants.map(({ slug, name }) => ({ slug, name }));
  const plantOf = (slug: string) =>
    plants.find((plant) => plant.slug === slug) ?? { slug, name: slug };
  return {
    fixture: g1.id,
    timeZone: g1.plant.timeZone,
    importedAtMs: Date.parse(inventory.stockImport.asOf.instant),
    defaultPlant: plantOf(inventory.defaultPlant),
    plants,
    warehouses: inventory.warehouses.map((warehouse) => ({
      code: warehouse.code,
      name: warehouse.name,
      externalCode: warehouse.externalCode,
      plant: warehouse.plant === null ? null : plantOf(warehouse.plant),
      stockRows: inventory.stock.filter((row) => row.warehouse === warehouse.code).length,
    })),
  };
}

/** A load that never answers: the loading state while the page waits for the server (WH3). */
const never = new Promise<WarehousesSnapshot>(() => {});

/**
 * The mock data source of the warehouses register (design #729): the fixture, or the page state
 * the URL's preview asks for, so the product owner opens WH3 to WH6 on mock data.
 */
export const g1WarehousesSource: WarehousesSource = {
  load: async ({ preview }) => {
    switch (preview) {
      case 'loading':
        return never;
      case 'empty': {
        // No stock import has run, so there is no import time either (WH4).
        const { importedAtMs: _, ...snapshot } = g1WarehousesSnapshot();
        return { ...snapshot, warehouses: [] };
      }
      case 'error':
        throw new Error('The warehouses could not be loaded');
      case 'forbidden':
        throw new WarehousesForbidden();
      default:
        return g1WarehousesSnapshot();
    }
  },
};
