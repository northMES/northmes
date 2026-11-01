// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreRestoreEquipmentGroupDocument as CoreRestoreEquipmentGroup,
  type CoreRestoreEquipmentGroupMutation,
  type CoreRestoreEquipmentGroupMutationVariables,
} from './restore-equipment-group.graphql.gen.ts';

// core.restoreEquipmentGroup on the group's page. pnpm gen writes its typed document to
// restore-equipment-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreRestoreEquipmentGroup($input: CoreRestoreEquipmentGroupInput!) {
      coreRestoreEquipmentGroup(input: $input) {
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
