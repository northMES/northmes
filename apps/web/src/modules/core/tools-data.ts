// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The seam between the tools register (design #729) and its data: a source answers the tools of
// the company and the plant, each with the routing operations that allow it. The pages never know
// which source they have. The first source is the master data fixture beside G1; core's tool API
// replaces it.

import type { MasterDataSource } from './routings-data.ts';

/** A routing operation that allows a tool, with what the tool changes there (ADR 0027). */
export interface ToolUse {
  readonly articleNumber: string;
  readonly articleName: string;
  readonly sequence: number;
  readonly operationName: string;
  /** The tool's pieces per cycle on the operation; none where it does not override. */
  readonly piecesPerCycle?: number;
  /** The operation's own pieces per cycle, which the tool's replaces. */
  readonly operationPiecesPerCycle: number;
  readonly machines: readonly { readonly name: string; readonly default: boolean }[];
  /** The numbers of the article's open production orders. */
  readonly openOrders: readonly string[];
}

export interface Tool {
  readonly code: string;
  readonly name: string;
  /** A tool of the whole company, or of one plant, by the name a page shows. */
  readonly scope: { readonly kind: 'company' | 'plant'; readonly name: string };
  readonly source: MasterDataSource;
  readonly importedAtMs: number;
  readonly uses: readonly ToolUse[];
}

export interface ToolsSnapshot {
  /** The id of the fixture a mock source answers with; a server source sets none. */
  readonly fixture?: string;
  readonly companyName: string;
  readonly plant: { readonly slug: string; readonly name: string; readonly timeZone: string };
  readonly nowMs: number;
  /** When the ERP's last import ran. */
  readonly importedAtMs?: number;
  readonly tools: readonly Tool[];
}

/** A page state the product owner can open on mock data (design #729, TO5 to TO8). */
export type ToolsPreview = 'loading' | 'empty' | 'error' | 'forbidden';

export interface ToolsSource {
  readonly load: (input: { readonly preview?: ToolsPreview }) => Promise<ToolsSnapshot>;
}

/** The refusal a source answers a forbidden preview with, as the API's FORBIDDEN would arrive. */
export class ToolsForbidden extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'ToolsForbidden';
  }
}
