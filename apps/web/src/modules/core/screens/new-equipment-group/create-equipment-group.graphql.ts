// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreCreateEquipmentGroupDocument as CoreCreateEquipmentGroup,
  type CoreCreateEquipmentGroupMutation,
  type CoreCreateEquipmentGroupMutationVariables,
} from './create-equipment-group.graphql.gen.ts';

// core.createEquipmentGroup on the new equipment group page. pnpm gen writes its typed document to
// create-equipment-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreCreateEquipmentGroup($input: CoreCreateEquipmentGroupInput!) {
      coreCreateEquipmentGroup(input: $input) {
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
