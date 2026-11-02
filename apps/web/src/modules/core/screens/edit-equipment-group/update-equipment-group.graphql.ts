// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreUpdateEquipmentGroupDocument as CoreUpdateEquipmentGroup,
  type CoreUpdateEquipmentGroupMutation,
  type CoreUpdateEquipmentGroupMutationVariables,
} from './update-equipment-group.graphql.gen.ts';

// core.updateEquipmentGroup on the group's edit form. pnpm gen writes its typed document to
// update-equipment-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreUpdateEquipmentGroup($input: CoreUpdateEquipmentGroupInput!) {
      coreUpdateEquipmentGroup(input: $input) {
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
