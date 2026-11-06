// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreRestoreEquipmentDocument as CoreRestoreEquipment,
  type CoreRestoreEquipmentMutation,
  type CoreRestoreEquipmentMutationVariables,
} from './restore-machine.graphql.gen.ts';

// core.restoreEquipment on the machine's page. pnpm gen writes its typed document to
// restore-machine.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreRestoreEquipment($input: CoreRestoreEquipmentInput!) {
      coreRestoreEquipment(input: $input) {
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
