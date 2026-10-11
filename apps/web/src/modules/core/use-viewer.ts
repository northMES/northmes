// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { useCompanyVariables } from './use-places.ts';
import { CoreViewer } from './viewer.graphql.ts';

/** What the access pages read of the signed-in user (design core-304, usePermission). */
export interface Viewer {
  /** The answer arrived; until then the user can do nothing, so no action shows early. */
  readonly loaded: boolean;
  readonly userId: string | undefined;
  /**
   * The user holds the permission at the plant in the URL, from a role there or at its company. In
   * company settings, at the company, which holds at each of its plants.
   */
  readonly can: (permission: string) => boolean;
  /** The user holds the permission at the company. */
  readonly canAtCompany: (permission: string) => boolean;
}

/**
 * The signed-in user's permissions at the plant and at its company, or in company settings at the
 * company (ADR 0066). A page hides or locks what the user cannot do with them; the API still checks
 * every change at the row's scope (ADR 0010).
 */
export function useViewer(): Viewer {
  const variables = useCompanyVariables();
  const { data } = useQuery(CoreViewer, { variables });
  const viewer = data?.coreViewer;
  const company = new Set(viewer?.companyPermissions ?? []);
  // A permission at the company holds at every plant of it, so in company settings, where the
  // answer names no plant, the company's permissions are those at each plant too.
  const plant =
    variables.companyId === undefined ? new Set(viewer?.plantPermissions ?? []) : company;
  return {
    loaded: viewer !== undefined,
    userId: viewer?.userId,
    can: (permission) => plant.has(permission),
    canAtCompany: (permission) => company.has(permission),
  };
}
