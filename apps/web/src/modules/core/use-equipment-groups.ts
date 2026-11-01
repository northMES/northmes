// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { CoreEquipmentGroups } from './equipment-groups.graphql.ts';
import { useEveryPage } from './master-data/use-every-page.ts';

/**
 * The equipment groups the plant sees, its own and the company's, by code, the active ones and with
 * includeArchived the archived ones too, every page of them. The list reads it from the network
 * each time it opens, so a group changed on another page shows; the group form reads it for the
 * colors in use.
 */
export function useEquipmentGroups(includeArchived: boolean) {
  return useEveryPage(
    CoreEquipmentGroups,
    'coreEquipmentGroups',
    { includeArchived },
    'cache-and-network',
  );
}
