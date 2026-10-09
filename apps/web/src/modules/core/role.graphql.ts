// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreRoleDocument as CoreRole,
  type CoreRoleQuery,
  type CoreRoleQueryVariables,
} from './role.graphql.gen.ts';

// One role of the company with who holds it at the company and at its plants, in company settings:
// the role page and the role editor read it. pnpm gen writes its typed document to
// role.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreRole($id: ID!, $companyId: ID!) {
      coreRole(id: $id, companyId: $companyId) {
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
