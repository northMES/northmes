// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreRemoveRoleAssignmentDocument as CoreRemoveRoleAssignment,
  type CoreRemoveRoleAssignmentMutation,
  type CoreRemoveRoleAssignmentMutationVariables,
} from './remove-role-assignment.graphql.gen.ts';

// Takes a role assignment away from its user, with the optional reason. pnpm gen writes its typed
// document to remove-role-assignment.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreRemoveRoleAssignment($input: CoreRemoveRoleAssignmentInput!) {
      coreRemoveRoleAssignment(input: $input) {
        id
      }
    }
  `;
}
