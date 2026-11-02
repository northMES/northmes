// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';
import type { CoreEquipmentListQuery } from './equipment-list.graphql.gen.ts';

export {
  CoreEquipmentListDocument as CoreEquipmentList,
  type CoreEquipmentListQuery,
  type CoreEquipmentListQueryVariables,
} from './equipment-list.graphql.gen.ts';

/** A machine as the lists read it, with its equipment group. */
export type MachineRow = CoreEquipmentListQuery['coreEquipmentList']['edges'][number]['node'];

// One page of the plant's machines by code, the active ones and with includeArchived the archived
// ones too, after the cursor `after`. useMachines reads every page, for the Machines list and the
// machines each equipment group holds. pnpm gen writes its typed document to
// equipment-list.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreEquipmentList($includeArchived: Boolean, $after: String) {
      coreEquipmentList(
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
            groupId
            group {
              id
              code
              name
              color
              scope
              archivedAt
            }
            isPlannable
            isOee
            color
            version
            archivedAt
            updatedAt
          }
        }
      }
    }
  `;
}
