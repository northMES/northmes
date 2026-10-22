// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The seam between the routing pages (design #729) and their data: a source answers the plant's
// routings, each operation with its rates, the machines it allows with their overrides, its tools
// and materials, and whether a planner keeps NorthMES values. The pages never know which source
// they have. The first source is the fixture G1 with the pages, inventory and master data fixtures
// beside it; core's routing API replaces it.

/** Who set a value: the ERP through the connector, the import on its own, or NorthMES. */
export type MasterDataSource = 'erp' | 'import' | 'northmes';

/** A machine an operation allows, with its overrides of the operation's values (ADR 0027). */
export interface RoutingMachine {
  readonly code: string;
  readonly name: string;
  readonly default: boolean;
  readonly cycleSeconds?: number;
  readonly piecesPerCycle?: number;
  readonly cyclesPerPiece?: number;
  readonly retoolSeconds?: number;
  readonly source: MasterDataSource;
  /** Who added a machine in NorthMES. */
  readonly addedBy?: string;
}

/** A tool an operation may use, with its pieces per cycle when it overrides. */
export interface RoutingTool {
  readonly code: string;
  readonly name: string;
  readonly piecesPerCycle?: number;
  readonly source: MasterDataSource;
}

/** A material an operation consumes per piece, from a warehouse (plan 07). */
export interface RoutingMaterial {
  readonly number: string;
  readonly name: string;
  readonly unit: string;
  readonly perPiece: number;
  readonly warehouse: string;
}

export interface RoutingOperation {
  readonly sequence: number;
  readonly name: string;
  readonly cycleSeconds: number;
  /** How the cycle time was entered: seconds per cycle, or pieces per hour (ADR 0023). */
  readonly cycleEntered: { readonly value: number; readonly unit: 'seconds' | 'piecesPerHour' };
  readonly retoolSeconds: number;
  readonly fixedSeconds: number;
  /** The OEE target, 0.85 for 85 %. */
  readonly oeeTarget: number;
  readonly piecesPerCycle: number;
  readonly cyclesPerPiece: number;
  readonly leadTimeS: number;
  readonly sendAheadQuantity: number;
  /** Keep NorthMES values: the import leaves the operation unchanged (plan 07, do_not_update). */
  readonly kept?: {
    readonly sinceMs: number;
    readonly by: string;
    readonly reason: string;
    /** The lead time the ERP sends, which the planner's value replaces. */
    readonly erpLeadTimeS: number;
  };
  readonly machines: readonly RoutingMachine[];
  readonly tools: readonly RoutingTool[];
  readonly materials: readonly RoutingMaterial[];
}

/** The active routing of an article (one per article, plan 07). */
export interface Routing {
  readonly articleNumber: string;
  readonly articleName: string;
  readonly erpVersion: number;
  readonly importedAtMs: number;
  readonly operations: readonly RoutingOperation[];
  /** The article's open production orders, the quantity the duration panel computes for. */
  readonly openOrders: readonly { readonly number: string; readonly quantity: number }[];
}

export interface RoutingsSnapshot {
  /** The id of the fixture a mock source answers with; a server source sets none. */
  readonly fixture?: string;
  readonly plant: { readonly slug: string; readonly name: string; readonly timeZone: string };
  /** Where the planning factor comes from at the plant: none, or the OEE target (plan 07). */
  readonly planningFactorSource: 'none' | 'oeeTarget';
  readonly routings: readonly Routing[];
}

/** A page state the product owner can open on mock data (design #729, RO5 to RO8). */
export type RoutingsPreview = 'loading' | 'empty' | 'error' | 'forbidden';

export interface RoutingsSource {
  readonly load: (input: { readonly preview?: RoutingsPreview }) => Promise<RoutingsSnapshot>;
}

/** The refusal a source answers a forbidden preview with, as the API's FORBIDDEN would arrive. */
export class RoutingsForbidden extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'RoutingsForbidden';
  }
}
