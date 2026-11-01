// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { currentPrincipal } from '../../../../principal.ts';
import { canOpen, heldAt } from './access.ts';
import { companyOf, forbidden } from './request-scope.ts';

/** What the signed-in user holds at one plant. */
export interface ViewerPlantRecord {
  readonly plantId: string;
  readonly permissions: readonly string[];
}

/** What the signed-in user holds where the request runs: at its plant and at the plant's company. */
export interface ViewerRecord {
  readonly userId: string;
  readonly plantPermissions: readonly string[];
  readonly companyPermissions: readonly string[];
  /**
   * What the user holds at each plant the request reads (ADR 0092): the request's plant, or in
   * company settings each plant of the company the user may open.
   */
  readonly plants: readonly ViewerPlantRecord[];
}

/**
 * The running request's principal where it runs (ADR 0010). At a plant: the permissions it holds
 * at the plant, from roles there and at the company, and those it holds at the company. In company
 * settings, a request without a plant that names one of the user's companies (ADR 0066): those it
 * holds at the company, none at a plant, and those it holds at each plant of the company it may
 * open. The web hides or locks what the user cannot do with
 * them; the command bus still checks every change. A request without a principal, or without a
 * plant and a company of the user, gets core.forbidden.
 */
export function viewerAt(companyId?: string): ViewerRecord {
  const principal = currentPrincipal();
  if (!principal) throw forbidden('Only a signed-in user has access to read');
  const plantId = principal.plantId;
  if (plantId) {
    const company = companyOf(principal, plantId);
    if (companyId !== undefined && companyId !== company) {
      throw forbidden(`Company ${companyId} is not the company of the request's plant`);
    }
    const plantPermissions = heldAt(principal, plantId);
    return {
      userId: principal.userId,
      plantPermissions,
      companyPermissions: heldAt(principal, company),
      plants: [{ plantId, permissions: plantPermissions }],
    };
  }
  if (companyId === undefined || principal.scopes.get(companyId)?.parentId !== null) {
    throw forbidden(
      'The request names no plant and none of your companies, so it has no access to read',
    );
  }
  const plants = [...principal.scopes.values()]
    // Only the plants the user may open, as coreCompanies lists them (ADR 0007).
    .filter(({ id, parentId }) => parentId === companyId && canOpen(principal, id))
    .map(({ id }) => ({ plantId: id, permissions: heldAt(principal, id) }));
  return {
    userId: principal.userId,
    plantPermissions: [],
    companyPermissions: heldAt(principal, companyId),
    plants,
  };
}
