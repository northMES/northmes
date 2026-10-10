// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreRolesDocument as CoreRoles,
  type CoreRolesQuery,
  type CoreRolesQueryVariables,
} from './roles.graphql.gen.ts';

// The roles of the company with their permissions and who holds them: the roles list, Start from on
// New role and the role picker of Add role read it in company settings with companyId, and Add role
// of People at a plant without. pnpm gen writes its typed document to roles.graphql.gen.ts; this
// block never runs.
if (false) {
  gql`
    query CoreRoles($companyId: ID) {
      coreRoles(companyId: $companyId) {
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
