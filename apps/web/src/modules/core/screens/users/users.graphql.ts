// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreUsersDocument as CoreUsers,
  type CoreUsersQuery,
  type CoreUsersQueryVariables,
} from './users.graphql.gen.ts';

// One page of the company's users, by name unless orderBy says otherwise and narrowed by a role
// and by status, each with their roles at the company and its plants.
// A role the reader may not read comes as null. pnpm gen writes its typed document to
// users.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CoreUsers(
      $companyId: ID!
      $first: Int
      $after: String
      $last: Int
      $before: String
      $search: String
      $orderBy: [UserOrderBy!]
      $roleId: ID
      $blocked: Boolean
    ) {
      coreUsers(
        companyId: $companyId
        first: $first
        after: $after
        last: $last
        before: $before
        search: $search
        orderBy: $orderBy
        roleId: $roleId
        blocked: $blocked
      ) {
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
          node {
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
              }
            }
          }
        }
      }
    }
  `;
}
