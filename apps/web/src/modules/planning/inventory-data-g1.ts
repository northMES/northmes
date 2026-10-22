// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { GanttInventoryFixture } from '@northmes/planning-domain';
import type { GanttSnapshot } from './gantt-data.ts';
import { g1Snapshot, stockOf } from './gantt-data-g1.ts';
import {
  InventoryForbidden,
  type InventorySnapshot,
  type InventorySource,
} from './inventory-data.ts';
import { inventoryOf } from './inventory-of.ts';

/**
 * The inventory snapshot of the fixture G1 at its plant, with the inventory fixture beside it, or
 * another inventory fixture a test gives.
 */
export function g1InventorySnapshot(
  plan: GanttSnapshot = g1Snapshot(),
  inventory?: GanttInventoryFixture,
): InventorySnapshot {
  const snapshot = inventoryOf(
    inventory === undefined ? plan : { ...plan, stock: stockOf(inventory) },
  );
  if (snapshot === undefined) throw new Error('The plan carries no stock');
  return snapshot;
}

/** A load that never answers: the loading state of a page while it waits for the server (ST4). */
const never = new Promise<InventorySnapshot>(() => {});

/**
 * The mock data source of the stock pages (design #729): every load answers with the fixture G1
 * and its pages and inventory fixtures, or with the page state the URL's preview asks for, so the
 * product owner opens the loading, empty, failed and no-access states on mock data.
 */
export const g1InventorySource: InventorySource = {
  load: async ({ preview }) => {
    switch (preview) {
      case 'loading':
        return never;
      case 'empty':
        return { ...g1InventorySnapshot(), balances: [], movements: [] };
      case 'error':
        throw new Error('The stock could not be loaded');
      case 'forbidden':
        throw new InventoryForbidden();
      default:
        return g1InventorySnapshot();
    }
  },
};
