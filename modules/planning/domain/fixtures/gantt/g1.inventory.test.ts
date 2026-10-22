// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1 } from '../../src/fixtures/gantt.ts';
import { g1Inventory } from '../../src/fixtures/gantt-inventory.ts';
import { g1Pages } from '../../src/fixtures/gantt-pages.ts';

/**
 * The inventory fixture beside G1 (design #729): warehouses, articles, operation materials, stock
 * balances and the ERP's planned movements. The test guards that it names only things G1, the
 * pages fixture or it defines, so the stock pages never meet a dangling reference.
 */
describe('the inventory fixture beside G1 (design #729)', () => {
  const plants = new Set(g1Pages.plants.map((plant) => plant.slug));
  const warehouses = new Set(g1Inventory.warehouses.map((warehouse) => warehouse.code));
  const articles = new Map(g1Inventory.articles.map((article) => [article.number, article]));

  it('#729 maps each warehouse to a plant of the pages fixture, or to none', () => {
    expect(plants.has(g1Inventory.defaultPlant)).toBe(true);
    for (const warehouse of g1Inventory.warehouses) {
      if (warehouse.plant !== null) expect(plants.has(warehouse.plant), warehouse.code).toBe(true);
    }
    expect(g1Inventory.warehouses.filter((warehouse) => warehouse.plant === null)).toHaveLength(1);
  });

  it('#729 gives every article of G1 a number, and every material a unit and a kind', () => {
    const finished = new Set(
      g1Inventory.articles.filter((article) => article.kind === 'finished').map((a) => a.name),
    );
    for (const order of g1.productionOrders) {
      expect(finished.has(order.article), order.number).toBe(true);
    }
  });

  it('#729 names a routing operation of G1 and a known material and warehouse in each operation material', () => {
    for (const material of g1Inventory.operationMaterials) {
      const routing = g1Pages.routings.find((each) => each.article === material.article);
      expect(
        routing?.operations.some((operation) => operation.sequence === material.sequence),
        `${material.article} ${material.sequence}`,
      ).toBe(true);
      expect(articles.get(material.material)?.kind, material.material).toBe('material');
      expect(warehouses.has(material.warehouse), material.warehouse).toBe(true);
    }
  });

  it('#729 names known warehouses and articles in the stock and the planned movements', () => {
    for (const row of [...g1Inventory.stock, ...g1Inventory.plannedMovements]) {
      expect(warehouses.has(row.warehouse), row.warehouse).toBe(true);
      expect(articles.has(row.article), row.article).toBe(true);
    }
  });

  it('#729 holds 92 m of Round bar 36 C45 in the warehouses of Plant A', () => {
    const plantA = new Set(
      g1Inventory.warehouses.filter((each) => each.plant === 'plant-a').map((each) => each.code),
    );
    const total = g1Inventory.stock
      .filter((row) => row.article === '30-2011' && plantA.has(row.warehouse))
      .reduce((sum, row) => sum + row.quantity, 0);
    expect(total).toBe(92);
  });
});
