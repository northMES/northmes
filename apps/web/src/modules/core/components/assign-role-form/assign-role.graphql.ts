// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreAssignRoleDocument as CoreAssignRole,
  type CoreAssignRoleMutation,
  type CoreAssignRoleMutationVariables,
} from './assign-role.graphql.gen.ts';

// Gives the user a role at the company or at the plant, and returns the assignment with the
// fields the user's page reads. pnpm gen writes its typed document to assign-role.graphql.gen.ts;
// this block never runs.
if (false) {
  gql`
    mutation CoreAssignRole($input: CoreAssignRoleInput!) {
      coreAssignRole(input: $input) {
        id
        scope {
          id
          kind
          name
        }
        role {
          id
          name
          permissions
        }
        # The role's Holders tab lists the assignment with its user.
        user {
          id
          name
          username
        }
      }
    }
  `;
}
