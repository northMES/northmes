// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreUpdateEquipmentDocument as CoreUpdateEquipment,
  type CoreUpdateEquipmentMutation,
  type CoreUpdateEquipmentMutationVariables,
} from './update-machine.graphql.gen.ts';

// core.updateEquipment on the machine's edit form. pnpm gen writes its typed document to
// update-machine.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreUpdateEquipment($input: CoreUpdateEquipmentInput!) {
      coreUpdateEquipment(input: $input) {
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
