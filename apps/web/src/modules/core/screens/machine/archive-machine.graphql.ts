// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { gql } from '@apollo/client';

export {
  CoreArchiveEquipmentDocument as CoreArchiveEquipment,
  type CoreArchiveEquipmentMutation,
  type CoreArchiveEquipmentMutationVariables,
} from './archive-machine.graphql.gen.ts';

// core.archiveEquipment on the machine's page. pnpm gen writes its typed document to
// archive-machine.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreArchiveEquipment($input: CoreArchiveEquipmentInput!) {
      coreArchiveEquipment(input: $input) {
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
