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
 * The running request's principal at its plant (ADR 0010): the permissions it holds at the plant,
 * from roles there and at the company, and those it holds at the company. The web hides or locks
 * what the user cannot do with them; the command bus still checks every change. A request without
 * a principal or without a plant gets core.forbidden.
 */
export function viewerAtPlant(): ViewerRecord {
  const principal = currentPrincipal();
  const plantId = principal?.plantId;
  if (!principal || !plantId) {
    throw forbidden('The request names no plant, so it has no access to read');
  }
  return {
    userId: principal.userId,
    plantPermissions: heldAt(principal, plantId),
    companyPermissions: heldAt(principal, companyOf(principal, plantId)),
  };
}
