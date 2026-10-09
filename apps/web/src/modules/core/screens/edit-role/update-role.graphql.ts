// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUpdateRoleDocument as CoreUpdateRole,
  type CoreUpdateRoleMutation,
  type CoreUpdateRoleMutationVariables,
} from './update-role.graphql.gen.ts';

// Saves a custom role's name and permissions with the version the edit started from. pnpm gen writes its typed document to update-role.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreUpdateRole($input: CoreUpdateRoleInput!) {
      coreUpdateRole(input: $input) {
        id
        name
        origin
        moduleId
        permissions
        version
        holders {
          id
          scope {
            id
            kind
            name
          }
          user {
            id
            name
            username
          }
        }
      }
    }
  `;
}
