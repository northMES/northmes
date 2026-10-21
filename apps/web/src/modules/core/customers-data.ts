// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The seam between the customers register (design #728) and its data: a source answers one
// snapshot of the company's customers and their open customer order lines, each with the
// production order that supplies it, in epoch milliseconds. The pages never know which source they
// have. The first source is the fixture G1 of @northmes/planning-domain with the pages fixture
// beside it. The lines and their supply are planning's data on a core page: the design proposes
// that planning fills them through slots (ADR 0068), which replace this seam's lines once a list
// column slot exists.

/** Who owns a record's master fields: the ERP through the connector, or NorthMES itself. */
export type CustomerOwner = 'erp' | 'northmes';

/** A customer of the company: number and name, all the ERP sends (ADR 0032). */
export interface Customer {
  readonly code: string;
  readonly name: string;
  readonly owner: CustomerOwner;
}

/** The production order that supplies a line, with what the pages say of it. */
export interface CustomerLineSupply {
  readonly orderId: string;
  readonly number: string;
  readonly status: 'planned' | 'released';
  readonly deadlineMs: number;
  readonly plannedStartMs?: number;
  readonly plannedEndMs?: number;
  /** Whether the order ends after its deadline at now (plan 18). */
  readonly late: boolean;
  /** Elapsed seconds from the planned end to the deadline, negative when late. */
  readonly slackElapsedS: number;
}

/** One open customer order line of a customer (plan 07, customer orders and demand). */
export interface CustomerLine {
  readonly id: string;
  readonly customerOrder: string;
  /** The customer's own order number. */
  readonly customersReference: string;
  readonly customerCode: string;
  readonly line: number;
  readonly article: string;
  readonly quantity: number;
  /** The wanted date as a plant date, "2026-11-06". */
  readonly wantedDate: string;
  /** The order that supplies the line; none while there is none. */
  readonly supply?: CustomerLineSupply;
}

export interface CustomersSnapshot {
  /** The id of the fixture a mock source answers with, such as G1; a server source sets none. */
  readonly fixture?: string;
  readonly plant: { readonly slug: string; readonly timeZone: string };
  readonly nowMs: number;
  /** The ERP connection as configured in Settings: its name is a value, never part of a label. */
  readonly erp?: { readonly name: string; readonly importedAtMs: number };
  readonly customers: readonly Customer[];
  readonly lines: readonly CustomerLine[];
}

/**
 * A page state the product owner can open on mock data (design #728, CU3 to CU5 and CC5): the mock
 * source answers it instead of the fixture; a server source ignores it.
 */
export type CustomersPreview = 'loading' | 'empty' | 'error';

export interface CustomersLoadInput {
  readonly preview?: CustomersPreview;
}

/** Where the customers pages read from. */
export interface CustomersSource {
  readonly load: (input: CustomersLoadInput) => Promise<CustomersSnapshot>;
}
