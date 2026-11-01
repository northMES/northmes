// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';
import type { CoreEquipmentGroupQuery } from './equipment-group.graphql.gen.ts';

export {
  CoreEquipmentGroupDocument as CoreEquipmentGroup,
  type CoreEquipmentGroupQuery,
  type CoreEquipmentGroupQueryVariables,
} from './equipment-group.graphql.gen.ts';

/** An equipment group with the fields its page and its form show and the version a change sends. */
export type EquipmentGroup = NonNullable<CoreEquipmentGroupQuery['coreEquipmentGroup']>;

// The equipment group with this id among those the plant sees, or null. The group's page and its
// edit form read it. pnpm gen writes its typed document to equipment-group.graphql.gen.ts; this
// block never runs.
if (false) {
  gql`
    query CoreEquipmentGroup($id: ID!) {
      coreEquipmentGroup(id: $id) {
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
  `;
}
