// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUserPermissionsDocument as CoreUserPermissions,
  type CoreUserPermissionsQuery,
  type CoreUserPermissionsQueryVariables,
} from './user-permissions.graphql.gen.ts';

// What the user may do at the plant: every installed permission with the roles that grant it
// there. It names roles, so a reader without core.role:read gets FORBIDDEN, and the Access tab
// shows that region denied. pnpm gen writes its typed document to user-permissions.graphql.gen.ts;
// this block never runs.
if (false) {
  gql`
    query CoreUserPermissions($id: ID!) {
      coreUser(id: $id) {
        id
        effectivePermissions {
          permission {
            key
            installed
          }
          grantedBy {
            id
            scope {
              id
              kind
              name
            }
            role {
              id
              name
            }
          }
        }
      }
    }
  `;
}
