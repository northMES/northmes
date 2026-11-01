// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreArchiveEquipmentGroupDocument as CoreArchiveEquipmentGroup,
  type CoreArchiveEquipmentGroupMutation,
  type CoreArchiveEquipmentGroupMutationVariables,
} from './archive-equipment-group.graphql.gen.ts';

// core.archiveEquipmentGroup on the group's page. pnpm gen writes its typed document to
// archive-equipment-group.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreArchiveEquipmentGroup($input: CoreArchiveEquipmentGroupInput!) {
      coreArchiveEquipmentGroup(input: $input) {
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
