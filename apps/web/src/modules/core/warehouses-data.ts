// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The seam between the warehouses register in company settings (design #729) and its data: a
// source answers the company's warehouses with the plant each maps to and how many stock rows the
// last import brought for it. The page never knows which source it has. The first source is the
// inventory fixture beside G1; core's warehouse API replaces it.

export interface WarehousePlant {
  readonly slug: string;
  readonly name: string;
}

export interface Warehouse {
  readonly code: string;
  readonly name: string;
  /** The warehouse's code in the ERP. */
  readonly externalCode: string;
  /** The plant whose orders and stock it holds; none while it maps to no plant. */
  readonly plant: WarehousePlant | null;
  /** The stock rows the last import brought for it. */
  readonly stockRows: number;
}

export interface WarehousesSnapshot {
  /** The id of the fixture a mock source answers with; a server source sets none. */
  readonly fixture?: string;
  readonly timeZone: string;
  /** When the ERP's stock import last ran; none before the first one. */
  readonly importedAtMs?: number;
  /** The plant an unmapped warehouse's orders go to (ADR 0032). */
  readonly defaultPlant: WarehousePlant;
  readonly plants: readonly WarehousePlant[];
  readonly warehouses: readonly Warehouse[];
}

/** A page state the product owner can open on mock data (design #729, WH3 to WH6). */
export type WarehousesPreview = 'loading' | 'empty' | 'error' | 'forbidden';

export interface WarehousesSource {
  readonly load: (input: { readonly preview?: WarehousesPreview }) => Promise<WarehousesSnapshot>;
}

/** The refusal a source answers a forbidden preview with, as the API's FORBIDDEN would arrive. */
export class WarehousesForbidden extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'WarehousesForbidden';
  }
}
