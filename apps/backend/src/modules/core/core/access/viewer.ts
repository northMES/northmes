// SPDX-License-Identifier: AGPL-3.0-or-later
import { currentPrincipal } from '../../../../principal.ts';
import { heldAt } from './access.ts';
import { companyOf, forbidden } from './request-scope.ts';

/** What the signed-in user holds where the request runs: at its plant and at the plant's company. */
export interface ViewerRecord {
  readonly userId: string;
  readonly plantPermissions: readonly string[];
  readonly companyPermissions: readonly string[];
}

/**
 * The running request's principal where it runs (ADR 0010). At a plant: the permissions it holds
 * at the plant, from roles there and at the company, and those it holds at the company. In company
 * settings, a request without a plant that names one of the user's companies (ADR 0066): those it
 * holds at the company, and none at a plant. The web hides or locks what the user cannot do with
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
    return {
      userId: principal.userId,
      plantPermissions: heldAt(principal, plantId),
      companyPermissions: heldAt(principal, company),
    };
  }
  if (companyId === undefined || principal.scopes.get(companyId)?.parentId !== null) {
    throw forbidden(
      'The request names no plant and none of your companies, so it has no access to read',
    );
  }
  return {
    userId: principal.userId,
    plantPermissions: [],
    companyPermissions: heldAt(principal, companyId),
  };
}
