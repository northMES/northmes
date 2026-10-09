// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreCreateRoleDocument as CoreCreateRole,
  type CoreCreateRoleMutation,
  type CoreCreateRoleMutationVariables,
} from './create-role.graphql.gen.ts';

// Creates a custom role with the fields the role page reads, which New role writes into CoreRole's
// cache. pnpm gen writes its typed document to create-role.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreCreateRole($input: CoreCreateRoleInput!) {
      coreCreateRole(input: $input) {
        id
        key
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
