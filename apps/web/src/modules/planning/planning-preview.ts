// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

/**
 * A page state the product owner can open on mock data (design D3, DR17 to DR22), as the plant
 * settings pages do: the mock source answers it instead of the fixture; a server source ignores
 * it.
 */
export type PlanningPreview = 'loading' | 'empty' | 'error' | 'forbidden';

/** The refusal a source answers a forbidden preview with, as the API's FORBIDDEN would arrive. */
export class PlanningForbidden extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'PlanningForbidden';
  }
}
