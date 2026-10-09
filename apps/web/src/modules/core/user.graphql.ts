// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUserDocument as CoreUser,
  type CoreUserQuery,
  type CoreUserQueryVariables,
} from './user.graphql.gen.ts';

// A user of the company with their roles at the company and at its plants, in company settings: the
// user page and Add role read it. A role the reader may not read comes as null. pnpm gen writes its
// typed document to user.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreUser($id: ID!, $companyId: ID!) {
      coreUser(id: $id, companyId: $companyId) {
        id
        name
        username
        blocked
        roleAssignments {
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
        }
      }
    }
  `;
}
