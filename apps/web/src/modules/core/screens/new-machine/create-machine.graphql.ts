// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreCreateEquipmentDocument as CoreCreateEquipment,
  type CoreCreateEquipmentMutation,
  type CoreCreateEquipmentMutationVariables,
} from './create-machine.graphql.gen.ts';

// core.createEquipment on the new machine page. pnpm gen writes its typed document to
// create-machine.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreCreateEquipment($input: CoreCreateEquipmentInput!) {
      coreCreateEquipment(input: $input) {
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
