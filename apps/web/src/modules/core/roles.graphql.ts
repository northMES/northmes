// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreRolesDocument as CoreRoles,
  type CoreRolesQuery,
  type CoreRolesQueryVariables,
} from './roles.graphql.gen.ts';

// The roles of the company with their permissions and who holds them at the company and at the
// plant: the roles list, Start from on New role and the role picker of Add role read it. pnpm gen
// writes its typed document to roles.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreRoles {
      coreRoles {
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
          }
          # The roles list counts the people who hold the role, once each.
          user {
            id
          }
        }
      }
    }
  `;
}
