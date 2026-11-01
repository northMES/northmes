// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';
import type { CoreEquipmentGroupsQuery } from './equipment-groups.graphql.gen.ts';

export {
  CoreEquipmentGroupsDocument as CoreEquipmentGroups,
  type CoreEquipmentGroupsQuery,
  type CoreEquipmentGroupsQueryVariables,
} from './equipment-groups.graphql.gen.ts';

/** An equipment group as the list and the group form's colors read it. */
export type EquipmentGroupRow =
  CoreEquipmentGroupsQuery['coreEquipmentGroups']['edges'][number]['node'];

// One page of the equipment groups the plant sees, its own and the company's, by code, the active
// ones and with includeArchived the archived ones too, after the cursor `after`.
// useEquipmentGroups reads every page, for the Equipment groups list and the colors the group form
// shows in use. pnpm gen writes its typed document to equipment-groups.graphql.gen.ts; this block
// never runs.
if (false) {
  gql`
    query CoreEquipmentGroups($includeArchived: Boolean, $after: String) {
      coreEquipmentGroups(
        first: 100
        after: $after
        includeArchived: $includeArchived
        orderBy: [{ field: CODE, direction: ASC }]
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            code
            name
            color
            colorFrom
            scope
            version
            archivedAt
            updatedAt
          }
        }
      }
    }
  `;
}
