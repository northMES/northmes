// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import inventoryJson from '../../fixtures/gantt/g1.inventory.json' with { type: 'json' };
import { timePoint } from './gantt.ts';

/**
 * What the stock pages and the material warning of design #729 show beside the fixture G1: the
 * company's warehouses and the plant each maps to, article numbers and units, the materials each
 * routing operation consumes, the stock balances of the last import and the ERP's own planned
 * movements. The mock data sources in apps/web derive consumption, output and customer demand from
 * G1's job orders and the pages fixture; nothing here changes what the Gantt's analysis reads.
 */

export const warehouse = z.object({
  code: z.string(),
  name: z.string(),
  /** The warehouse's code in the ERP. */
  externalCode: z.string(),
  /** The slug of the plant the warehouse maps to; null for one that maps to none. */
  plant: z.string().nullable(),
});

export const inventoryArticle = z.object({
  number: z.string(),
  name: z.string(),
  /** The stock unit as the pages write it, "pcs" or "m". */
  unit: z.string(),
  /** A finished article planning makes, or a material it consumes. */
  kind: z.enum(['finished', 'material']),
});

/** The material a routing operation consumes per piece, from a warehouse. */
export const operationMaterial = z.object({
  /** The article of the routing, by name as G1 names it. */
  article: z.string(),
  sequence: z.number().int().positive(),
  /** The material's article number. */
  material: z.string(),
  perPiece: z.number().positive(),
  warehouse: z.string(),
});

export const stockRow = z.object({
  warehouse: z.string(),
  /** The article number. */
  article: z.string(),
  quantity: z.number(),
});

/** A movement the ERP plans itself: a purchase, a requisition or a transfer, dated by plant date. */
export const erpMovement = z.object({
  kind: z.enum(['purchase', 'purchaseRequisition', 'transferIn', 'transferOut']),
  reference: z.string(),
  warehouse: z.string(),
  article: z.string(),
  /** Signed: incoming is positive. */
  quantity: z.number(),
  date: z.iso.date(),
});

export const ganttInventoryFixture = z.object({
  id: z.literal('G1-inventory'),
  description: z.string(),
  /** The plant whose orders an unmapped warehouse's orders go to. */
  defaultPlant: z.string(),
  /** Whether purchase requisitions count in the projection (a plant setting, plan 07). */
  countPurchaseRequisitions: z.boolean(),
  /** The last plant date the projection covers. */
  projectedTo: z.iso.date(),
  stockImport: z.object({ asOf: timePoint, next: timePoint }),
  warehouses: z.array(warehouse).nonempty(),
  articles: z.array(inventoryArticle).nonempty(),
  /** Where the output of a production order goes. */
  outputWarehouse: z.string(),
  operationMaterials: z.array(operationMaterial),
  stock: z.array(stockRow),
  plannedMovements: z.array(erpMovement),
});

export type GanttInventoryFixture = z.infer<typeof ganttInventoryFixture>;

/** The inventory fixture beside G1, parsed once. */
export const g1Inventory: GanttInventoryFixture = ganttInventoryFixture.parse(inventoryJson);
