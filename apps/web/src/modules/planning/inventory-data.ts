// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The seam between the stock pages (design #729) and their data: a source answers one snapshot of
// the plant's stock balances and planned movements, each movement already dated in epoch
// milliseconds by plan 07's rules. The pages never know which source they have. The first source
// is the fixture G1 with the pages and inventory fixtures beside it; the planning server's stock
// snapshot and projectMaterial() replace it value by value.

/** An article as the stock pages read it: number, name, stock unit and kind. */
export interface InventoryArticle {
  readonly number: string;
  readonly name: string;
  /** The stock unit as the pages write it, "pcs" or "m". */
  readonly unit: string;
  readonly kind: 'finished' | 'material';
}

export interface InventoryWarehouse {
  readonly code: string;
  readonly name: string;
  /** The slug of the plant the warehouse maps to; none when it maps to no plant. */
  readonly plant: string | null;
}

export interface StockBalance {
  readonly warehouse: string;
  /** The article number. */
  readonly article: string;
  readonly quantity: number;
}

export type MovementKind =
  | 'purchase'
  | 'purchaseRequisition'
  | 'transferIn'
  | 'transferOut'
  | 'consumption'
  | 'output'
  | 'customerDemand';

/** A planned movement of an article, dated where the projection counts it (plan 07). */
export interface PlannedMovement {
  readonly id: string;
  readonly kind: MovementKind;
  /** The article number. */
  readonly article: string;
  readonly warehouse: string;
  /** Signed: incoming is positive. */
  readonly quantity: number;
  /** Where the projection counts it. */
  readonly atMs: number;
  /** Whether the date is a plant date without a time, which sorts at 00:00. */
  readonly dateOnly: boolean;
  /** Where the date comes from, in words: "Setup start of 1003.10", "ERP date", "Now, overdue". */
  readonly dateFrom: string;
  /** The ERP's own date of an overdue movement, a plant date. */
  readonly overdueSince?: string;
  /**
   * Where an overdue movement was dated before it moved to now: the movements counted at now keep
   * their own order among themselves.
   */
  readonly dueMs?: number;
  /** The reference as the movements table writes it: "Purchase order 7712", "1003.10", "1001". */
  readonly reference: string;
  /** The job order that consumes, for a consumption. */
  readonly jobOrder?: {
    readonly id: string;
    readonly displayNumber: string;
    readonly operationName: string;
    readonly orderId: string;
    readonly article: string;
    /** The machine's name; none while the job order is not placed. */
    readonly machine?: string;
  };
  /** The production order, for an output. */
  readonly productionOrder?: { readonly id: string; readonly number: string };
  /** The customer order line, for customer demand. */
  readonly customerOrderLine?: {
    readonly customerOrder: string;
    readonly line: number;
    readonly customerName: string;
    /** The production order that supplies the line, if any. */
    readonly productionOrder?: { readonly id: string; readonly number: string };
  };
  /** Whether the projection counts it: purchase requisitions follow a plant setting. */
  readonly counted: boolean;
}

export interface InventorySnapshot {
  /** The id of the fixture a mock source answers with, such as G1; a server source sets none. */
  readonly fixture?: string;
  readonly plant: { readonly slug: string; readonly name: string; readonly timeZone: string };
  readonly nowMs: number;
  /** When the ERP's stock balances were taken. */
  readonly stockAsOfMs: number;
  /** When the next stock import is due; none when no import runs. */
  readonly nextImportMs?: number;
  /** The instant the projection ends: the end of its last plant date. */
  readonly projectedToMs: number;
  /** The last plant date the projection covers, "2026-11-13". */
  readonly projectedTo: string;
  /** Whether purchase requisitions count (a plant setting, plan 07). */
  readonly countPurchaseRequisitions: boolean;
  /** The company's warehouses: the pages count those mapped to this plant only. */
  readonly warehouses: readonly InventoryWarehouse[];
  readonly articles: readonly InventoryArticle[];
  readonly balances: readonly StockBalance[];
  /** The plant's planned movements up to the end of the projection, in no particular order. */
  readonly movements: readonly PlannedMovement[];
}

/**
 * A page state the product owner can open on mock data (design #729, ST4 to ST7): the mock source
 * answers it instead of the fixture; a server source ignores it.
 */
export type InventoryPreview = 'loading' | 'empty' | 'error' | 'forbidden';

export interface InventorySource {
  readonly load: (input: { readonly preview?: InventoryPreview }) => Promise<InventorySnapshot>;
}

/** The refusal a source answers a forbidden preview with, as the API's FORBIDDEN would arrive. */
export class InventoryForbidden extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'InventoryForbidden';
  }
}
