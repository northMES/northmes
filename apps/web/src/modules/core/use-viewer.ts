// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { CoreViewer } from './viewer.graphql.ts';

/** What the access pages read of the signed-in user (design core-304, usePermission). */
export interface Viewer {
  /** The answer arrived; until then the user can do nothing, so no action shows early. */
  readonly loaded: boolean;
  readonly userId: string | undefined;
  /** The user holds the permission at the plant in the URL, from a role there or at its company. */
  readonly can: (permission: string) => boolean;
  /** The user holds the permission at the plant's company. */
  readonly canAtCompany: (permission: string) => boolean;
}

/**
 * The signed-in user's permissions at the plant and at its company. A page hides or locks what the
 * user cannot do with them; the API still checks every change at the row's scope (ADR 0010).
 */
export function useViewer(): Viewer {
  const { data } = useQuery(CoreViewer);
  const viewer = data?.coreViewer;
  const plant = new Set(viewer?.plantPermissions ?? []);
  const company = new Set(viewer?.companyPermissions ?? []);
  return {
    loaded: viewer !== undefined,
    userId: viewer?.userId,
    can: (permission) => plant.has(permission),
    canAtCompany: (permission) => company.has(permission),
  };
}
