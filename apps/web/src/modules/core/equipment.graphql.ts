// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';
import type { CoreEquipmentQuery } from './equipment.graphql.gen.ts';

export {
  CoreEquipmentDocument as CoreEquipment,
  type CoreEquipmentQuery,
  type CoreEquipmentQueryVariables,
} from './equipment.graphql.gen.ts';

/** A machine with the fields its page and its form show and the version a change sends. */
export type Machine = NonNullable<CoreEquipmentQuery['coreEquipment']>;

// The machine with this id among the plant's, or null. The machine's page and its edit form read
// it. pnpm gen writes its typed document to equipment.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreEquipment($id: ID!) {
      coreEquipment(id: $id) {
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
  `;
}
